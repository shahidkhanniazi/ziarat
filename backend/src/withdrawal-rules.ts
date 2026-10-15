import { toMinor } from './amounts.js';
import type { AssetDef } from './assets.js';
import { AppError } from './errors.js';
import { encodeErc20Transfer, isEvmAddress, toHexQuantity } from './evm.js';

export interface WithdrawalInput {
  address: string;
  amount: string;
}

export interface ValidatedWithdrawal {
  address: string;
  amount: bigint;
}

/** Pure request validation: address format, amount precision, positivity and per-transaction limit. */
export function validateWithdrawal(input: WithdrawalInput, asset: AssetDef): ValidatedWithdrawal {
  const address = input.address.trim();
  if (!isEvmAddress(address)) {
    throw new AppError(400, 'INVALID_ADDRESS', 'Enter a valid EVM wallet address (0x...).');
  }
  const amount = toMinor(input.amount.trim(), asset.decimals);
  if (amount <= 0n) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  if (!asset.limits) {
    throw new AppError(503, 'LIMITS_NOT_SET', `Withdrawal limits for ${asset.code} are not configured.`);
  }
  if (amount > asset.limits.perTx) {
    throw new AppError(422, 'LIMIT_PER_TX', `Amount exceeds the per-transaction limit for ${asset.code}.`);
  }
  return { address, amount };
}

export function checkDailyLimit(asset: AssetDef, alreadyWithdrawn: bigint, amount: bigint): void {
  if (!asset.limits) throw new AppError(503, 'LIMITS_NOT_SET', `Limits for ${asset.code} are not configured.`);
  if (alreadyWithdrawn + amount > asset.limits.perDay) {
    throw new AppError(422, 'LIMIT_PER_DAY', `Daily withdrawal limit for ${asset.code} reached.`);
  }
}

export type SendOutcome = 'rejected' | 'unknown';

/**
 * A 4xx from the wallet provider means the transaction was definitely NOT broadcast, so the held
 * funds can safely be released. Anything else (timeout, 5xx, network error) is ambiguous: the
 * transaction may have been broadcast, so funds stay held and the case goes to manual review.
 */
export function classifySendError(error: unknown): SendOutcome {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return 'rejected';
  }
  return 'unknown';
}

export interface EvmTx {
  to: string;
  value?: string;
  data?: string;
}

/** Builds the transaction Privy will sign: native transfer, or ERC-20 transfer(to, amount) on the token contract. */
export function buildTransaction(asset: AssetDef, address: string, amount: bigint): EvmTx {
  if (asset.native) return { to: address, value: toHexQuantity(amount) };
  if (!asset.contract) throw new Error(`${asset.code} has no contract configured.`);
  return { to: asset.contract, data: encodeErc20Transfer(address, amount) };
}
