// Requires a disposable PostgreSQL with db/001..003 applied. Run: DATABASE_URL=... npm run test:integration
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.DATABASE_URL;
const skip = url ? false : 'DATABASE_URL not set';
const pool = url ? new pg.Pool({ connectionString: url }) : (null as unknown as pg.Pool);

async function seed() {
  const u = await pool.query(`INSERT INTO users (external_user_id) VALUES ($1) RETURNING id`, [`did:privy:test-${Math.random()}`]);
  const userId = u.rows[0].id as string;
  const t = await pool.query(
    `INSERT INTO crypto_transactions (user_id, asset, network, type, amount_minor, status, address, idempotency_key)
     VALUES ($1,'ETH','eip155:1','withdrawal',100,'needs_review','0x0',$2) RETURNING id`,
    [userId, `k-${Math.random()}-xxxxxxxxxxxxxxxx`],
  );
  return { userId, txId: t.rows[0].id as string };
}

test('ledger_entries is append-only', { skip }, async () => {
  const { userId } = await seed();
  await pool.query(`INSERT INTO ledger_entries (user_id,asset,network,direction,amount_minor,balance_after,reason) VALUES ($1,'ETH','eip155:1','credit',5,5,'deposit')`, [userId]);
  await assert.rejects(pool.query(`UPDATE ledger_entries SET amount_minor = 6 WHERE user_id = $1`, [userId]), /append-only/);
  await assert.rejects(pool.query(`DELETE FROM ledger_entries WHERE user_id = $1`, [userId]), /append-only/);
});

test('a refund can be written only once per transaction', { skip }, async () => {
  const { userId, txId } = await seed();
  const ins = () => pool.query(`INSERT INTO ledger_entries (user_id,asset,network,direction,amount_minor,balance_after,reason,ref_id) VALUES ($1,'ETH','eip155:1','credit',100,100,'withdrawal_refund',$2)`, [userId, txId]);
  await ins();
  await assert.rejects(ins(), /ledger_entries_once|duplicate key/);
});

test('terminal transaction states are final and money fields immutable', { skip }, async () => {
  const { txId } = await seed();
  await pool.query(`UPDATE crypto_transactions SET status='failed' WHERE id=$1`, [txId]);
  await assert.rejects(pool.query(`UPDATE crypto_transactions SET status='needs_review' WHERE id=$1`, [txId]), /final/);
  await assert.rejects(pool.query(`UPDATE crypto_transactions SET amount_minor=999 WHERE id=$1`, [txId]), /immutable/);
});

test('balances cannot go negative', { skip }, async () => {
  const { userId } = await seed();
  await assert.rejects(pool.query(`INSERT INTO ledger_accounts (user_id,asset,network,balance_minor) VALUES ($1,'ETH','eip155:1',-1)`, [userId]));
});

test('concurrent debits cannot overdraw (row-lock + guarded UPDATE)', { skip }, async () => {
  const { userId } = await seed();
  await pool.query(`INSERT INTO ledger_accounts (user_id,asset,network,balance_minor) VALUES ($1,'ETH','eip155:1',100)`, [userId]);
  const debit = () => pool.query(`UPDATE ledger_accounts SET balance_minor = balance_minor - 80 WHERE user_id=$1 AND asset='ETH' AND balance_minor >= 80 RETURNING balance_minor`, [userId]);
  const results = await Promise.all([debit(), debit(), debit()]);
  assert.equal(results.filter((r) => r.rowCount === 1).length, 1);
});

test.after(async () => { if (url) await pool.end(); });
