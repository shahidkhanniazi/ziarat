import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isTxHash } from './chain-rules.js';
import { env } from './config.js';
import { pool, tx } from './db.js';
import { AppError } from './errors.js';
import { isEvmAddress } from './evm.js';
import { refundWithdrawal } from './settlement.js';
import { toMinor, fromMinor } from './amounts.js';
import { findByCode } from './assets.js';
import { registry } from './config.js';

function keyMatches(provided: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(env.ADMIN_API_KEY ?? '').digest();
  return timingSafeEqual(a, b);
}

function actorOf(req: FastifyRequest): string {
  const actor = String(req.headers['x-admin-actor'] ?? '').trim();
  if (actor.length < 2 || actor.length > 80) throw new AppError(400, 'ACTOR_REQUIRED', 'X-Admin-Actor header (operator name) is required.');
  return actor;
}

async function audit(actor: string, action: string, target: string, detail: object, c: { query: (text: string, values?: unknown[]) => Promise<unknown> } = pool) {
  await c.query('INSERT INTO admin_actions (actor, action, target, detail) VALUES ($1, $2, $3, $4)', [actor, action, target, JSON.stringify(detail)]);
}

/** Operator tooling. Disabled (404) unless ADMIN_API_KEY is set. Expose only on a private network / VPN. */
export async function registerAdmin(app: FastifyInstance): Promise<void> {
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', async (req) => {
        if (!env.ADMIN_API_KEY) throw new AppError(404, 'NOT_FOUND', 'Not found.');
        if (!keyMatches(String(req.headers['x-admin-key'] ?? ''))) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid admin key.');
      });

      admin.get('/withdrawals/review', async () => {
        const r = await pool.query(
          `SELECT id, user_id, asset, network, amount_minor::text, status, address, tx_hash, created_at, updated_at
             FROM crypto_transactions WHERE type = 'withdrawal' AND status IN ('needs_review','pending')
            ORDER BY created_at LIMIT 200`,
        );
        return { items: r.rows };
      });

      // refund: ONLY after verifying with the wallet provider/explorer that nothing was broadcast.
      // confirm: attach the real tx hash; the reconciler then settles it from the chain (the operator cannot mark it confirmed).
      admin.post('/withdrawals/:id/resolve', async (req) => {
        const actor = actorOf(req);
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        const body = z
          .object({ action: z.enum(['refund', 'confirm']), txHash: z.string().optional(), note: z.string().min(10).max(500) })
          .parse(req.body);
        if (body.action === 'refund') {
          const ok = await refundWithdrawal(id, ['needs_review'], `manual refund by ${actor}: ${body.note}`);
          if (!ok) throw new AppError(409, 'NOT_REFUNDABLE', 'Only withdrawals in needs_review can be refunded.');
          await audit(actor, 'withdrawal_refund', id, { note: body.note });
          return { id, resolved: 'refunded' };
        }
        if (!body.txHash || !isTxHash(body.txHash)) throw new AppError(400, 'TX_HASH_REQUIRED', 'A valid transaction hash is required.');
        const r = await pool.query(
          `UPDATE crypto_transactions SET status = 'submitted', tx_hash = $2, updated_at = now()
            WHERE id = $1 AND type = 'withdrawal' AND status = 'needs_review'`,
          [id, body.txHash],
        );
        if (!r.rowCount) throw new AppError(409, 'NOT_CONFIRMABLE', 'Only withdrawals in needs_review can be re-attached.');
        await audit(actor, 'withdrawal_attach_hash', id, { txHash: body.txHash, note: body.note });
        return { id, resolved: 'submitted', note: 'The reconciler will settle it from the chain.' };
      });

      admin.post('/users/:id/kyc', async (req) => {
        const actor = actorOf(req);
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        const body = z.object({ status: z.enum(['unverified', 'pending', 'approved', 'rejected']), note: z.string().min(10).max(500) }).parse(req.body);
        await tx(async (c) => {
          const r = await c.query('UPDATE users SET kyc_status = $2 WHERE id = $1', [id, body.status]);
          if (!r.rowCount) throw new AppError(404, 'USER_NOT_FOUND', 'No such user.');
          await audit(actor, 'kyc_status', id, body, c);
        });
        return { id, kycStatus: body.status };
      });

      admin.get('/blocked-addresses', async () => ({ items: (await pool.query('SELECT address, reason, created_by, created_at FROM blocked_addresses ORDER BY created_at DESC')).rows }));
      admin.post('/blocked-addresses', async (req) => {
        const actor = actorOf(req);
        const body = z.object({ address: z.string(), reason: z.string().min(5).max(300) }).parse(req.body);
        if (!isEvmAddress(body.address.trim())) throw new AppError(400, 'INVALID_ADDRESS', 'Invalid EVM address.');
        const address = body.address.trim().toLowerCase();
        await pool.query('INSERT INTO blocked_addresses (address, reason, created_by) VALUES ($1, $2, $3) ON CONFLICT (address) DO NOTHING', [address, body.reason, actor]);
        await audit(actor, 'block_address', address, { reason: body.reason });
        return { address, blocked: true };
      });

      // Pricing. Human units (e.g. "1.5" USDT). Changes apply to NEW withdrawals only and are audit-logged.
      admin.get('/crypto-fees', async () => ({ items: (await pool.query('SELECT asset, percentage_bps, min_fee_minor::text, max_fee_minor::text, enabled, updated_by, updated_at FROM crypto_fee_rules ORDER BY asset')).rows }));
      admin.put('/crypto-fees', async (req) => {
        const actor = actorOf(req);
        const b = z.object({
          asset: z.string(), percentageBps: z.number().int().min(0).max(2000),
          minFee: z.string(), maxFee: z.string().nullable(), enabled: z.boolean(), note: z.string().min(10).max(300),
        }).parse(req.body);
        const asset = findByCode(registry, b.asset);
        if (!asset) throw new AppError(400, 'UNSUPPORTED_ASSET', 'Asset is not enabled on this deployment.');
        const min = toMinor(b.minFee, asset.decimals);
        const max = b.maxFee === null ? null : toMinor(b.maxFee, asset.decimals);
        if (max !== null && max < min) throw new AppError(400, 'INVALID_FEE', 'maxFee must be >= minFee.');
        await tx(async (c) => {
          await c.query(
            `INSERT INTO crypto_fee_rules (asset, percentage_bps, min_fee_minor, max_fee_minor, enabled, updated_by, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6, now())
             ON CONFLICT (asset) DO UPDATE SET percentage_bps=$2, min_fee_minor=$3, max_fee_minor=$4, enabled=$5, updated_by=$6, updated_at=now()`,
            [asset.code, b.percentageBps, min.toString(), max === null ? null : max.toString(), b.enabled, actor],
          );
          await audit(actor, 'crypto_fee_rule', asset.code, b, c);
        });
        return { asset: asset.code, saved: true };
      });

      // Revenue: treasury balances (earned, net of refunds) and fee income per day for the last 30 days.
      admin.get('/revenue', async () => {
        const bal = await pool.query(
          `SELECT a.asset, a.network, a.balance_minor::text AS earned_minor FROM ledger_accounts a
             JOIN users u ON u.id = a.user_id WHERE u.external_user_id = 'ziarat:treasury' ORDER BY a.asset`,
        );
        const daily = await pool.query(
          `SELECT date_trunc('day', e.created_at)::date AS day, e.asset,
                  SUM(CASE WHEN e.direction = 'credit' THEN e.amount_minor ELSE -e.amount_minor END)::text AS net_fees_minor,
                  count(*) FILTER (WHERE e.reason = 'fee_income')::int AS fee_events
             FROM ledger_entries e JOIN users u ON u.id = e.user_id
            WHERE u.external_user_id = 'ziarat:treasury' AND e.created_at > now() - interval '30 days'
            GROUP BY 1, 2 ORDER BY 1 DESC, 2`,
        );
        const dec = (code: string) => findByCode(registry, code)?.decimals ?? 18;
        return {
          earned: bal.rows.map((r) => ({ asset: r.asset, network: r.network, amount: fromMinor(r.earned_minor, dec(r.asset)) })),
          last30Days: daily.rows.map((r) => ({ day: r.day, asset: r.asset, netFees: fromMinor(r.net_fees_minor, dec(r.asset)), feeEvents: r.fee_events })),
        };
      });

      // Ledger integrity: every account balance must equal the sum of its audit entries. Run on a schedule and alert on any row.
      admin.get('/reconciliation', async () => {
        const mism = await pool.query(
          `SELECT a.user_id, a.asset, a.network, a.balance_minor::text AS balance,
                  COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0)::text AS entries_sum
             FROM ledger_accounts a
             LEFT JOIN ledger_entries e ON e.user_id = a.user_id AND e.asset = a.asset AND e.network = a.network
            GROUP BY a.id
           HAVING a.balance_minor <> COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0)`,
        );
        const liabilities = await pool.query(
          `SELECT asset, network, SUM(balance_minor)::text AS total_owed_minor FROM ledger_accounts GROUP BY asset, network ORDER BY asset`,
        );
        const stuck = await pool.query(
          `SELECT status, count(*)::int AS n FROM crypto_transactions
            WHERE status IN ('pending','submitted','needs_review') AND updated_at < now() - interval '15 minutes' GROUP BY status`,
        );
        return { ledgerMismatches: mism.rows, ok: mism.rowCount === 0, liabilities: liabilities.rows, stuckOver15Min: stuck.rows };
      });
    },
    { prefix: '/admin' },
  );
}
