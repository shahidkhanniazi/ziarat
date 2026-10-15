import { tx } from './db.js';
import { credit, debit } from './ledger.js';
import { treasuryUserId } from './crypto-fees.js';

/**
 * Atomically flips a withdrawal to 'failed' and returns the held funds. The status flip and the refund are one
 * database transaction, and the DB itself refuses a second refund (unique ledger entry + final-status trigger).
 * Returns false when the withdrawal was not in one of the allowed source states.
 */
export async function refundWithdrawal(id: string, allowedFrom: string[], reason: string): Promise<boolean> {
  return tx(async (c) => {
    const r = await c.query(
      `UPDATE crypto_transactions SET status = 'failed', failure_reason = $3, updated_at = now()
        WHERE id = $1 AND type = 'withdrawal' AND status = ANY($2::text[])
        RETURNING user_id, asset, network, amount_minor, fee_minor`,
      [id, allowedFrom, reason.slice(0, 300)],
    );
    const row = r.rows[0];
    if (!row) return false;
    await credit(c, {
      userId: row.user_id as string,
      asset: row.asset as string,
      network: row.network as string,
      amount: BigInt(row.amount_minor),
      reason: 'withdrawal_refund',
      refId: id,
    });
    const fee = BigInt(row.fee_minor);
    if (fee > 0n) {
      // A failed withdrawal earns nothing: give the fee back and reverse the treasury income.
      await credit(c, { userId: row.user_id as string, asset: row.asset as string, network: row.network as string, amount: fee, reason: 'withdrawal_fee_refund', refId: id });
      await debit(c, { userId: await treasuryUserId(c), asset: row.asset as string, network: row.network as string, amount: fee, reason: 'fee_income_reversal', refId: id });
    }
    return true;
  });
}
