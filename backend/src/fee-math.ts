export interface FeeRuleMinor {
  percentageBps: bigint;
  fixedMinor: bigint;
  minimumMinor: bigint | null;
  maximumMinor: bigint | null;
  providerCostBps: bigint;
  providerCostFixedMinor: bigint;
}

const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;

/** Fee = ceil(amount * bps / 10000) + fixed, then clamped to [minimum, maximum]. Integer math only. */
export function computeFee(amountMinor: bigint, rule: FeeRuleMinor): { feeMinor: bigint; providerCostMinor: bigint } {
  if (amountMinor <= 0n) throw new RangeError('Amount must be positive.');
  let fee = ceilDiv(amountMinor * rule.percentageBps, 10000n) + rule.fixedMinor;
  if (rule.minimumMinor !== null && fee < rule.minimumMinor) fee = rule.minimumMinor;
  if (rule.maximumMinor !== null && fee > rule.maximumMinor) fee = rule.maximumMinor;
  const providerCostMinor = ceilDiv(amountMinor * rule.providerCostBps, 10000n) + rule.providerCostFixedMinor;
  return { feeMinor: fee, providerCostMinor };
}

export interface AssetFeeRule {
  percentageBps: bigint;
  minFeeMinor: bigint;
  maxFeeMinor: bigint | null;
}

/** Asset-denominated fee: ceil(amount * bps / 10000), clamped to [min, max]. Integer math only. */
export function computeAssetFee(amount: bigint, rule: AssetFeeRule): bigint {
  if (amount <= 0n) throw new RangeError('Amount must be positive.');
  let fee = ceilDiv(amount * rule.percentageBps, 10000n);
  if (fee < rule.minFeeMinor) fee = rule.minFeeMinor;
  if (rule.maxFeeMinor !== null && fee > rule.maxFeeMinor) fee = rule.maxFeeMinor;
  return fee;
}

/** Largest amount such that amount + fee(amount) <= available (binary search; fee is non-decreasing in amount). */
export function maxSendable(available: bigint, rule: AssetFeeRule | null): bigint {
  if (available <= 0n) return 0n;
  if (!rule) return available;
  let lo = 0n;
  let hi = available;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (mid + computeAssetFee(mid, rule) <= available) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}
