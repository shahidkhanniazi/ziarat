import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { pool } from './db.js';
import { computeFee } from './fee-math.js';

export const FEE_QUOTE_TTL_SECONDS = 300;
export type FeeService = {
  code: string; name: string; description: string; currency: string;
  enabled: boolean; percentageBps: number; fixedMinor: string;
  minimumMinor: string | null; maximumMinor: string | null;
  providerCostBps: number; providerCostFixedMinor: string;
};

export async function listFeeServices() {
  const result = await pool.query(`SELECT s.code, s.name, s.description, s.currency,
      s.enabled, r.percentage_bps, r.fixed_minor::text, r.minimum_minor::text,
      r.maximum_minor::text, r.provider_cost_bps, r.provider_cost_fixed_minor::text
    FROM fee_services s LEFT JOIN fee_rules r ON r.service_code = s.code AND r.currency = s.currency
    ORDER BY s.sort_order, s.code`);
  return result.rows.map((r) => ({
    code: r.code, name: r.name, description: r.description, currency: r.currency,
    enabled: r.enabled && r.percentage_bps != null,
    configured: r.percentage_bps != null,
    percentageBps: r.percentage_bps === null ? null : Number(r.percentage_bps),
    fixedMinor: r.fixed_minor ?? null, minimumMinor: r.minimum_minor ?? null,
    maximumMinor: r.maximum_minor ?? null, providerCostBps: r.provider_cost_bps === null ? null : Number(r.provider_cost_bps),
    providerCostFixedMinor: r.provider_cost_fixed_minor ?? null,
  }));
}

export async function createFeeQuote(input: { serviceCode: string; amount: string; currency: string }, userId: string) {
  if (input.currency !== 'USD') throw new AppError(400, 'UNSUPPORTED_FEE_CURRENCY', 'Fee quotes currently support USD only.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(input.amount)) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a positive USD amount with up to 2 decimal places.');
  const [whole = '0', fraction = ''] = input.amount.split('.');
  const amountMinor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (amountMinor <= 0n) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  const result = await pool.query(`SELECT s.code, s.name, s.enabled, r.percentage_bps, r.fixed_minor::text,
      r.minimum_minor::text, r.maximum_minor::text, r.provider_cost_bps, r.provider_cost_fixed_minor::text
    FROM fee_services s LEFT JOIN fee_rules r ON r.service_code=s.code AND r.currency=s.currency
    WHERE s.code=$1 AND s.currency=$2`, [input.serviceCode, input.currency]);
  const rule = result.rows[0];
  if (!rule) throw new AppError(404, 'UNKNOWN_FEE_SERVICE', 'This fee service does not exist.');
  if (!rule.enabled) throw new AppError(409, 'FEE_SERVICE_DISABLED', 'This service is not enabled for fee quotations.');
  if (rule.percentage_bps === null) throw new AppError(409, 'FEE_RULE_NOT_CONFIGURED', 'A fee rule has not been configured for this service.');
  const { feeMinor, providerCostMinor } = computeFee(amountMinor, {
    percentageBps: BigInt(rule.percentage_bps),
    fixedMinor: BigInt(rule.fixed_minor),
    minimumMinor: rule.minimum_minor === null ? null : BigInt(rule.minimum_minor),
    maximumMinor: rule.maximum_minor === null ? null : BigInt(rule.maximum_minor),
    providerCostBps: BigInt(rule.provider_cost_bps),
    providerCostFixedMinor: BigInt(rule.provider_cost_fixed_minor),
  });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FEE_QUOTE_TTL_SECONDS * 1000);
  const id = randomUUID();
  await pool.query(`INSERT INTO fee_quotes (id, service_code, currency, amount_minor, fee_minor, provider_cost_minor, expires_at, user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, input.serviceCode, input.currency, amountMinor.toString(), feeMinor.toString(), providerCostMinor.toString(), expiresAt, userId]);
  return { quoteId: id, serviceCode: input.serviceCode, currency: input.currency,
    amount: formatUsd(amountMinor), fee: formatUsd(feeMinor), providerCostEstimate: formatUsd(providerCostMinor),
    total: formatUsd(amountMinor + feeMinor), expiresAt: expiresAt.toISOString(),
    validForSeconds: FEE_QUOTE_TTL_SECONDS, informationalOnly: true,
    note: 'This quote does not execute a transaction or collect a fee.' };
}
function formatUsd(minor: bigint) { return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`; }
