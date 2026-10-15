import { registry, env } from './config.js';
import { isUniqueViolation, pool, tx } from './db.js';
import { parseDepositEvent, parseWithdrawalEvent } from './deposit-parse.js';
import { findByDeposit } from './assets.js';
import { getTxState } from './chain.js';
import { decideDeposit, isTxHash } from './chain-rules.js';
import { MalformedEventError } from './errors.js';
import { sameAddress } from './evm.js';
import { credit } from './ledger.js';

/**
 * Processes one verified Privy webhook delivery and returns a short outcome label.
 * Safe to call more than once for the same delivery (Privy delivers at least once).
 */
export async function processWebhook(payload: unknown, deliveryId: string): Promise<string> {
  await pool.query(
    `INSERT INTO webhook_events (provider, event_id, payload) VALUES ('privy', $1, $2)
     ON CONFLICT (provider, event_id) DO NOTHING`,
    [deliveryId, JSON.stringify(payload)],
  );
  const prior = await pool.query(`SELECT outcome FROM webhook_events WHERE provider = 'privy' AND event_id = $1`, [deliveryId]);
  if (prior.rows[0]?.outcome) return 'duplicate_delivery';

  const outcome = await route(payload, deliveryId);
  await pool.query(`UPDATE webhook_events SET outcome = $2 WHERE provider = 'privy' AND event_id = $1`, [deliveryId, outcome]);
  return outcome;
}

async function route(payload: unknown, deliveryId: string): Promise<string> {
  try {
    const deposit = parseDepositEvent(payload, deliveryId);
    if (deposit) return await applyDeposit(deposit);
    const withdrawal = parseWithdrawalEvent(payload, deliveryId);
    if (withdrawal) return await noteWithdrawal(withdrawal.txHash);
    return 'ignored_event_type';
  } catch (error) {
    if (error instanceof MalformedEventError) return 'malformed'; // retrying cannot fix it; stays stored for inspection
    throw error; // transient (e.g. database): let Privy retry
  }
}

/** Records the deposit as 'pending'. It is credited only once the transaction has enough confirmations on-chain. */
async function applyDeposit(d: NonNullable<ReturnType<typeof parseDepositEvent>>): Promise<string> {
  const wallet = await pool.query(
    `SELECT user_id, address FROM wallets WHERE provider = 'privy' AND provider_wallet_id = $1`,
    [d.walletId],
  );
  if (!wallet.rowCount) return 'unknown_wallet';

  const asset = findByDeposit(registry, d.caip2, d.assetType, d.assetAddress);
  if (!asset) return 'unsupported_asset';
  if (!d.recipient || !sameAddress(d.recipient, wallet.rows[0].address)) return 'recipient_mismatch';
  if (d.amount <= 0n) return 'zero_amount';
  if (!isTxHash(d.txHash)) return 'malformed';

  const userId = wallet.rows[0].user_id as string;
  let id: string;
  try {
    const ins = await pool.query(
      `INSERT INTO crypto_transactions
         (user_id, asset, network, type, amount_minor, status, address, tx_hash, provider_event_id)
       VALUES ($1, $2, $3, 'deposit', $4, 'pending', $5, $6, $7)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING id`,
      [userId, asset.code, asset.caip2, d.amount.toString(), d.sender, d.txHash, d.eventId],
    );
    if (!ins.rowCount) return 'duplicate_deposit';
    id = ins.rows[0].id as string;
  } catch (error) {
    if (isUniqueViolation(error)) return 'duplicate_deposit';
    throw error;
  }
  try {
    return await settleDeposit(id);
  } catch {
    return 'pending_confirmation'; // RPC hiccup: the reconciler retries; never fail the webhook after the row exists
  }
}

/** Credits a pending deposit if (and only if) the chain confirms it. Idempotent; safe to call repeatedly. */
export async function settleDeposit(id: string): Promise<string> {
  const r = await pool.query(
    `SELECT tx_hash FROM crypto_transactions WHERE id = $1 AND type = 'deposit' AND status = 'pending'`,
    [id],
  );
  const row = r.rows[0];
  if (!row) return 'already_settled';

  // Without an RPC endpoint (development only; production refuses to start) there is nothing to verify against.
  const action = env.ZIARAT_RPC_URL ? decideDeposit(await getTxState(row.tx_hash as string), env.ZIARAT_MIN_CONFIRMATIONS) : 'credit';
  if (action === 'wait') return 'pending_confirmation';

  return tx(async (c) => {
    const flipped = await c.query(
      `UPDATE crypto_transactions SET status = $2, updated_at = now()
        WHERE id = $1 AND status = 'pending' RETURNING user_id, asset, network, amount_minor`,
      [id, action === 'credit' ? 'confirmed' : 'failed'],
    );
    const t = flipped.rows[0];
    if (!t) return 'already_settled';
    if (action === 'fail') return 'deposit_reverted';
    await credit(c, {
      userId: t.user_id as string,
      asset: t.asset as string,
      network: t.network as string,
      amount: BigInt(t.amount_minor),
      reason: 'deposit',
      refId: id,
    });
    return 'credited';
  });
}

/**
 * With an RPC endpoint the webhook is only a nudge: settlement is decided by the reconciler from the chain,
 * so a webhook that arrives before the hash is stored (or before finality) cannot lose or mis-state a withdrawal.
 */
async function noteWithdrawal(txHash: string): Promise<string> {
  if (env.ZIARAT_RPC_URL) return 'withdrawal_noted';
  const r = await pool.query(
    `UPDATE crypto_transactions SET status = 'confirmed', updated_at = now()
      WHERE type = 'withdrawal' AND status = 'submitted' AND lower(tx_hash) = lower($1)`,
    [txHash],
  );
  return r.rowCount ? 'withdrawal_confirmed' : 'withdrawal_unmatched';
}
