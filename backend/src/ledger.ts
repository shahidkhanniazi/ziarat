import type { PoolClient } from 'pg';
import { AppError } from './errors.js';

interface Movement {
  userId: string;
  asset: string;
  network: string;
  amount: bigint;
  reason: 'deposit' | 'withdrawal' | 'withdrawal_refund' | 'withdrawal_fee' | 'fee_income' | 'withdrawal_fee_refund' | 'fee_income_reversal';
  refId?: string;
}

/** Adds funds and writes an audit entry. Must run inside a transaction. */
export async function credit(c: PoolClient, m: Movement): Promise<bigint> {
  if (m.amount <= 0n) throw new AppError(400, 'INVALID_LEDGER_AMOUNT', 'Ledger credits must be greater than zero.');
  const r = await c.query(
    `INSERT INTO ledger_accounts (user_id, asset, network, balance_minor)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, asset, network)
     DO UPDATE SET balance_minor = ledger_accounts.balance_minor + EXCLUDED.balance_minor, updated_at = now()
     RETURNING balance_minor`,
    [m.userId, m.asset, m.network, m.amount.toString()],
  );
  const after = BigInt(r.rows[0].balance_minor);
  await writeEntry(c, m, 'credit', after);
  return after;
}

/** Removes funds if (and only if) the balance covers it. Must run inside a transaction. */
export async function debit(c: PoolClient, m: Movement): Promise<bigint> {
  if (m.amount <= 0n) throw new AppError(400, 'INVALID_LEDGER_AMOUNT', 'Ledger debits must be greater than zero.');
  const r = await c.query(
    `UPDATE ledger_accounts
        SET balance_minor = balance_minor - $4, updated_at = now()
      WHERE user_id = $1 AND asset = $2 AND network = $3 AND balance_minor >= $4
      RETURNING balance_minor`,
    [m.userId, m.asset, m.network, m.amount.toString()],
  );
  if (r.rowCount === 0) throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Insufficient balance.');
  const after = BigInt(r.rows[0].balance_minor);
  await writeEntry(c, m, 'debit', after);
  return after;
}

/** Locks and returns the current balance (0 when no account exists). */
export async function lockedBalance(c: PoolClient, userId: string, asset: string, network: string): Promise<bigint> {
  const r = await c.query(
    'SELECT balance_minor FROM ledger_accounts WHERE user_id = $1 AND asset = $2 AND network = $3 FOR UPDATE',
    [userId, asset, network],
  );
  return r.rowCount ? BigInt(r.rows[0].balance_minor) : 0n;
}

async function writeEntry(c: PoolClient, m: Movement, direction: 'credit' | 'debit', after: bigint): Promise<void> {
  await c.query(
    `INSERT INTO ledger_entries (user_id, asset, network, direction, amount_minor, balance_after, reason, ref_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [m.userId, m.asset, m.network, direction, m.amount.toString(), after.toString(), m.reason, m.refId ?? null],
  );
}
