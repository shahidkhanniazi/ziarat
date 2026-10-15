import { env } from './config.js';
import { getTxState } from './chain.js';
import { decideSubmittedWithdrawal } from './chain-rules.js';
import { pool } from './db.js';
import { settleDeposit } from './deposits.js';
import { refundWithdrawal } from './settlement.js';

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export interface ReconcileSummary {
  ran: boolean;
  pendingToReview: number;
  withdrawalsConfirmed: number;
  withdrawalsRefunded: number;
  withdrawalsToReview: number;
  depositsSettled: number;
  needsReviewOpen: number;
}

export const reconcileState = { lastRunAt: null as Date | null, lastOk: false };
const LOCK_ID = 727_001;

/**
 * One reconciliation pass. Single-flight across all API instances (advisory lock). Every decision is made from
 * on-chain state; RPC failures leave rows untouched (unknown is never treated as failed).
 */
export async function reconcileOnce(log: Logger): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    ran: false, pendingToReview: 0, withdrawalsConfirmed: 0, withdrawalsRefunded: 0,
    withdrawalsToReview: 0, depositsSettled: 0, needsReviewOpen: 0,
  };
  const lock = await pool.connect();
  try {
    const got = await lock.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_ID]);
    if (!got.rows[0]?.ok) return summary;
    summary.ran = true;

    // A: crash between "debit + pending row" and "send": outcome unknown -> human review (never auto-refund).
    const stale = await pool.query(
      `UPDATE crypto_transactions SET status = 'needs_review', updated_at = now()
        WHERE type = 'withdrawal' AND status = 'pending' AND tx_hash IS NULL
          AND created_at < now() - ($1::int * interval '1 second')`,
      [env.ZIARAT_PENDING_TIMEOUT_SECONDS],
    );
    summary.pendingToReview = stale.rowCount ?? 0;

    if (env.ZIARAT_RPC_URL) {
      // B: submitted withdrawals -> settle from the chain.
      const subs = await pool.query(
        `SELECT id, tx_hash, EXTRACT(EPOCH FROM (now() - updated_at))::int AS age
           FROM crypto_transactions
          WHERE type = 'withdrawal' AND status = 'submitted' AND tx_hash IS NOT NULL
          ORDER BY updated_at LIMIT 200`,
      );
      for (const row of subs.rows) {
        try {
          const state = await getTxState(row.tx_hash as string);
          const action = decideSubmittedWithdrawal(state, Number(row.age), env.ZIARAT_MIN_CONFIRMATIONS, env.ZIARAT_DROPPED_TX_SECONDS);
          if (action === 'confirm') {
            const r = await pool.query(
              `UPDATE crypto_transactions SET status = 'confirmed', updated_at = now() WHERE id = $1 AND status = 'submitted'`,
              [row.id],
            );
            summary.withdrawalsConfirmed += r.rowCount ?? 0;
          } else if (action === 'refund') {
            if (await refundWithdrawal(row.id as string, ['submitted'], 'transaction reverted on-chain')) summary.withdrawalsRefunded++;
          } else if (action === 'review') {
            const r = await pool.query(
              `UPDATE crypto_transactions SET status = 'needs_review', updated_at = now() WHERE id = $1 AND status = 'submitted'`,
              [row.id],
            );
            summary.withdrawalsToReview += r.rowCount ?? 0;
          }
        } catch (error) {
          log.warn({ id: row.id, error: String(error) }, 'reconcile: could not check withdrawal; will retry');
        }
      }
    }

    // C: pending deposits -> credit once confirmed.
    const deps = await pool.query(
      `SELECT id FROM crypto_transactions WHERE type = 'deposit' AND status = 'pending' ORDER BY created_at LIMIT 200`,
    );
    for (const row of deps.rows) {
      try {
        if ((await settleDeposit(row.id as string)) === 'credited') summary.depositsSettled++;
      } catch (error) {
        log.warn({ id: row.id, error: String(error) }, 'reconcile: could not settle deposit; will retry');
      }
    }

    // D: housekeeping.
    await pool.query(`DELETE FROM fee_quotes WHERE expires_at < now() - interval '1 day'`);

    const open = await pool.query(`SELECT count(*)::int AS n FROM crypto_transactions WHERE type = 'withdrawal' AND status = 'needs_review'`);
    summary.needsReviewOpen = open.rows[0]?.n ?? 0;
    if (summary.needsReviewOpen > 0) log.error({ needsReviewOpen: summary.needsReviewOpen }, 'ALERT: withdrawals awaiting manual review');
    reconcileState.lastOk = true;
    return summary;
  } catch (error) {
    reconcileState.lastOk = false;
    log.error({ error: String(error) }, 'reconcile pass failed');
    return summary;
  } finally {
    reconcileState.lastRunAt = new Date();
    try { await lock.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); } catch { /* connection dropped: lock released with it */ }
    lock.release();
  }
}
