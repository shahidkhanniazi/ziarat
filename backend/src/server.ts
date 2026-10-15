import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { fromMinor } from './amounts.js';
import { loadFeeRule, quoteWithdrawalFee } from './crypto-fees.js';
import { maxSendable } from './fee-math.js';
import { createFeeQuote, listFeeServices } from './fee-engine.js';
import { findByCode, type AssetDef } from './assets.js';
import { authenticate } from './auth.js';
import { env, registry } from './config.js';
import { pool } from './db.js';
import { processWebhook } from './deposits.js';
import { registerAdmin } from './admin.js';
import { reconcileOnce, reconcileState } from './reconcile.js';
import { AppError } from './errors.js';
import { verifyWebhook } from './privy.js';
import { ensureUser, getOrCreateEvmWallet } from './wallets.js';
import { nativeGasReserve, requestWithdrawal } from './withdrawals.js';

const app = Fastify({
  bodyLimit: 1024 * 1024,
  trustProxy: env.TRUST_PROXY,
  logger: { level: 'info', redact: ['req.headers.authorization', 'req.headers["x-ziarat-user-id"]'] },
});

await app.register(cors, {
  origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : false,
});
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

function requireAsset(code: string): AssetDef {
  const asset = findByCode(registry, code);
  if (!asset) throw new AppError(400, 'UNSUPPORTED_ASSET', 'This asset is not supported.');
  return asset;
}

function withdrawalsOpen(asset: AssetDef): boolean {
  return env.ZIARAT_WITHDRAWALS_ENABLED && asset.limits !== null;
}

// ---------- health ----------
app.get('/health', async () => ({ ok: true, service: 'ziarat-wallet-backend', time: new Date().toISOString() }));
app.get('/ready', async () => {
  await pool.query('SELECT 1');
  return { ready: true, reconciler: { lastRunAt: reconcileState.lastRunAt?.toISOString() ?? null, lastOk: reconcileState.lastOk } };
});

app.addHook('onSend', async (_req, reply, payload) => {
  reply.header('Cache-Control', 'no-store');
  reply.header('X-Content-Type-Options', 'nosniff');
  return payload;
});

// ---------- fee structure (quotes only; never executes or collects funds) ----------
app.get('/v1/fees/services', async () => ({ services: await listFeeServices() }));
app.post('/v1/fees/quote', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
  const userId = await ensureUser(await authenticate(req));
  const body = z.object({
    serviceCode: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/),
    amount: z.string().min(1).max(16),
    currency: z.string().length(3).transform((v) => v.toUpperCase()).default('USD'),
  }).parse(req.body);
  return createFeeQuote(body, userId);
});

// ---------- assets + balances ----------
app.get('/v1/crypto/assets', async (req) => {
  const userId = await ensureUser(await authenticate(req));
  const rows = await pool.query('SELECT asset, network, balance_minor FROM ledger_accounts WHERE user_id = $1', [userId]);
  const balances = new Map<string, bigint>(rows.rows.map((r) => [`${r.asset}:${r.network}`, BigInt(r.balance_minor)]));

  return {
    withdrawalsEnabled: env.ZIARAT_WITHDRAWALS_ENABLED,
    assets: registry.map((a) => {
      const balance = balances.get(`${a.code}:${a.caip2}`) ?? 0n;
      const reserve = nativeGasReserve(a);
      const available = balance > reserve ? balance - reserve : 0n;
      return {
        code: a.code,
        symbol: a.code,
        name: a.name,
        network: a.networkLabel,
        networkId: a.caip2,
        decimals: a.decimals,
        native: a.native,
        balance: fromMinor(balance, a.decimals),
        available: fromMinor(available, a.decimals),
        withdrawalsEnabled: withdrawalsOpen(a),
      };
    }),
  };
});

// ---------- withdrawal fee (shown to the user BEFORE they confirm) ----------
app.get('/v1/crypto/fee-quote', async (req) => {
  await authenticate(req);
  const q = z.object({ asset: z.string().min(2).max(10), amount: z.string().min(1).max(40) }).parse(req.query);
  return quoteWithdrawalFee(pool, requireAsset(q.asset), q.amount);
});
app.get('/v1/crypto/max-sendable', async (req) => {
  const userId = await ensureUser(await authenticate(req));
  const q = z.object({ asset: z.string().min(2).max(10) }).parse(req.query);
  const asset = requireAsset(q.asset);
  const r = await pool.query('SELECT balance_minor FROM ledger_accounts WHERE user_id = $1 AND asset = $2 AND network = $3', [userId, asset.code, asset.caip2]);
  const balance = r.rowCount ? BigInt(r.rows[0].balance_minor) : 0n;
  const reserve = nativeGasReserve(asset);
  const available = balance > reserve ? balance - reserve : 0n;
  let max = maxSendable(available, await loadFeeRule(pool, asset.code));
  if (asset.limits && max > asset.limits.perTx) max = asset.limits.perTx;
  return { asset: asset.code, amount: fromMinor(max, asset.decimals) };
});

// ---------- deposit address ----------
app.post('/v1/crypto/deposit-address', async (req) => {
  const userId = await ensureUser(await authenticate(req));
  const body = z.object({ asset: z.string().min(2).max(10) }).parse(req.body);
  const asset = requireAsset(body.asset);
  const wallet = await getOrCreateEvmWallet(userId);
  return {
    asset: asset.code,
    network: asset.networkLabel,
    networkId: asset.caip2,
    address: wallet.address,
    warning: `Only send ${asset.code} on ${asset.networkLabel} to this address. Other assets or networks may be lost.`,
  };
});

// ---------- transactions ----------
app.get('/v1/crypto/transactions', async (req) => {
  const userId = await ensureUser(await authenticate(req));
  const q = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.string().datetime().optional() })
    .parse(req.query);
  const r = await pool.query(
    `SELECT id, asset, network, type, amount_minor, fee_minor, status, address, tx_hash, created_at
       FROM crypto_transactions
      WHERE user_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      ORDER BY created_at DESC LIMIT $3`,
    [userId, q.before ?? null, q.limit],
  );
  const transactions = r.rows.map((row) => {
    const asset = registry.find((a) => a.code === row.asset && a.caip2 === row.network);
    return {
      id: row.id,
      asset: row.asset,
      symbol: row.asset,
      network: asset?.networkLabel ?? row.network,
      type: row.type,
      amount: fromMinor(row.amount_minor, asset?.decimals ?? 18),
      fee: fromMinor(row.fee_minor, asset?.decimals ?? 18),
      status: row.status,
      address: row.address,
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at).toISOString(),
    };
  });
  return { transactions, nextBefore: transactions.length === q.limit ? transactions[transactions.length - 1]?.createdAt ?? null : null };
});

// ---------- withdrawals ----------
app.post('/v1/crypto/withdrawals', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
  const userId = await ensureUser(await authenticate(req));
  const key = String(req.headers['idempotency-key'] ?? '');
  if (key.length < 16 || key.length > 100) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A unique Idempotency-Key header (16-100 chars) is required.');
  }
  const body = z
    .object({ asset: z.string().min(2).max(10), address: z.string().min(10).max(100), amount: z.string().min(1).max(40) })
    .parse(req.body);
  const result = await requestWithdrawal(userId, requireAsset(body.asset), body, key, req.log);
  return reply.code(result.status === 'needs_review' ? 202 : 200).send(result);
});

// ---------- Privy webhooks (needs the RAW body for signature verification) ----------
await app.register(async (scope) => {
  scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body));

  scope.post('/v1/webhooks/privy', { config: { rateLimit: false } }, async (req, reply) => {
    const raw = String(req.body ?? '');
    const headers = {
      id: String(req.headers['svix-id'] ?? ''),
      timestamp: String(req.headers['svix-timestamp'] ?? ''),
      signature: String(req.headers['svix-signature'] ?? ''),
    };
    if (!headers.id || !headers.timestamp || !headers.signature) {
      return reply.code(401).send({ error: { code: 'UNSIGNED', message: 'Missing signature headers.' } });
    }
    let event: unknown;
    try {
      event = verifyWebhook(raw, headers);
    } catch {
      return reply.code(401).send({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } });
    }
    const outcome = await processWebhook(event, headers.id);
    req.log.info({ deliveryId: headers.id, outcome }, 'privy webhook processed');
    return { received: true, outcome };
  });
});

// ---------- errors ----------
app.setErrorHandler((err, req, reply) => {
  if (err instanceof AppError) {
    return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return reply.code(400).send({
      error: { code: 'VALIDATION', message: 'Invalid request.', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
    });
  }
  const status = (err as { statusCode?: number }).statusCode;
  if (status && status >= 400 && status < 500) {
    return reply.code(status).send({ error: { code: 'REQUEST_ERROR', message: err.message } });
  }
  req.log.error(err);
  return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
});

// Registered after the error handler so admin routes inherit it.
await registerAdmin(app);

// ---------- lifecycle ----------
const reconcileTimer = setInterval(() => void reconcileOnce(app.log), env.ZIARAT_RECONCILE_INTERVAL_SECONDS * 1000);
reconcileTimer.unref();
void reconcileOnce(app.log);

const shutdown = async (signal: string) => {
  clearInterval(reconcileTimer);
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
