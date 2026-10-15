import { pool, tx } from './db.js';
import { createEvmWallet } from './privy.js';

export interface WalletRow {
  id: string;
  user_id: string;
  provider_wallet_id: string;
  address: string;
}

export async function ensureUser(externalUserId: string): Promise<string> {
  const found = await pool.query('SELECT id FROM users WHERE external_user_id = $1', [externalUserId]);
  if (found.rowCount) return found.rows[0].id as string;
  const r = await pool.query(
    `INSERT INTO users (external_user_id) VALUES ($1)
     ON CONFLICT (external_user_id) DO UPDATE SET external_user_id = EXCLUDED.external_user_id
     RETURNING id`,
    [externalUserId],
  );
  return r.rows[0].id as string;
}

/** One EVM wallet per user, created on first use. Serialised per user so it can never be created twice. */
export async function getOrCreateEvmWallet(userId: string): Promise<WalletRow> {
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`wallet:${userId}`]);
    const existing = await c.query(
      `SELECT id, user_id, provider_wallet_id, address FROM wallets WHERE user_id = $1 AND chain_type = 'ethereum'`,
      [userId],
    );
    if (existing.rowCount) return existing.rows[0] as WalletRow;

    const created = await createEvmWallet(`ziarat-${userId}-evm`);
    const inserted = await c.query(
      `INSERT INTO wallets (user_id, provider, provider_wallet_id, chain_type, address)
       VALUES ($1, 'privy', $2, 'ethereum', $3)
       RETURNING id, user_id, provider_wallet_id, address`,
      [userId, created.id, created.address],
    );
    return inserted.rows[0] as WalletRow;
  });
}
