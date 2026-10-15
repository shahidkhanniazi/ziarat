import { fromMinor, toMinor } from './amounts.js';
import type { AssetDef } from './assets.js';
import { AppError } from './errors.js';
import { computeAssetFee, type AssetFeeRule } from './fee-math.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Q = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export async function loadFeeRule(q: Q, asset: string): Promise<AssetFeeRule | null> {
  const r = await q.query(
    `SELECT percentage_bps, min_fee_minor::text AS min_fee, max_fee_minor::text AS max_fee FROM crypto_fee_rules WHERE asset = $1 AND enabled`,
    [asset],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { percentageBps: BigInt(row.percentage_bps), minFeeMinor: BigInt(row.min_fee), maxFeeMinor: row.max_fee === null ? null : BigInt(row.max_fee) };
}

export async function treasuryUserId(q: Q): Promise<string> {
  const r = await q.query(`SELECT id FROM users WHERE external_user_id = 'ziarat:treasury'`);
  if (!r.rows[0]) throw new Error('Treasury user missing: apply db/004_revenue.sql.');
  return r.rows[0].id as string;
}

/** Fee for a withdrawal amount; throws when the fee would swallow the whole amount. */
export async function withdrawalFee(q: Q, asset: AssetDef, amount: bigint): Promise<bigint> {
  const rule = await loadFeeRule(q, asset.code);
  if (!rule) return 0n;
  const fee = computeAssetFee(amount, rule);
  if (fee > 0n && fee >= amount) {
    throw new AppError(422, 'AMOUNT_TOO_SMALL', `Amount is too small to cover the withdrawal fee (${fromMinor(fee, asset.decimals)} ${asset.code}).`);
  }
  return fee;
}

export async function quoteWithdrawalFee(q: Q, asset: AssetDef, amountText: string) {
  const amount = toMinor(amountText.trim(), asset.decimals);
  if (amount <= 0n) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  const fee = await withdrawalFee(q, asset, amount);
  return {
    asset: asset.code,
    amount: fromMinor(amount, asset.decimals),
    fee: fromMinor(fee, asset.decimals),
    total: fromMinor(amount + fee, asset.decimals),
  };
}
