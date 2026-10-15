import { AppError } from './errors.js';

/** Converts a decimal string ("12.5") into integer minor units (bigint). Never uses floating point. */
export function toMinor(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 78) {
    throw new AppError(400, 'INVALID_DECIMALS', 'Decimal precision must be an integer between 0 and 78.');
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a positive decimal number.');
  }
  const [whole = '0', fraction = ''] = amount.split('.');
  if (fraction.length > decimals) {
    throw new AppError(400, 'TOO_MANY_DECIMALS', `This asset supports at most ${decimals} decimal places.`);
  }
  const padded = fraction.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded === '' ? '0' : padded);
}

/** Converts integer minor units into a trimmed decimal string. */
export function fromMinor(value: string | number | bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 78) {
    throw new RangeError('Decimal precision must be an integer between 0 and 78.');
  }
  const n = BigInt(value);
  if (n < 0n) throw new RangeError('Minor-unit value cannot be negative.');
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const fraction = (n % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Parses an integer string already expressed in base units (e.g. wei), as sent by Privy webhooks. */
export function parseBaseUnits(value: unknown): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error('Amount is not a non-negative integer in base units.');
}
