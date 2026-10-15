import { keccak256Hex } from './keccak.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** EIP-55 checksum form of a 20-byte hex address. */
export function toChecksumAddress(address: string): string {
  const lower = address.slice(2).toLowerCase();
  const hash = keccak256Hex(lower);
  let out = '0x';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]!;
    out += /[a-f]/.test(ch) && parseInt(hash[i]!, 16) >= 8 ? ch.toUpperCase() : ch;
  }
  return out;
}

/**
 * Valid EVM address. All-lowercase or all-uppercase hex is accepted (no checksum was intended);
 * mixed case MUST carry a correct EIP-55 checksum, which catches typos.
 */
export function isEvmAddress(value: string): boolean {
  if (!ADDRESS_RE.test(value)) return false;
  const body = value.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(value) === value;
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** ABI-encodes ERC-20 transfer(address,uint256). */
export function encodeErc20Transfer(to: string, amount: bigint): string {
  if (!isEvmAddress(to)) throw new Error('Invalid recipient address.');
  if (amount < 0n || amount >= 2n ** 256n) throw new Error('Amount out of range.');
  const selector = 'a9059cbb';
  const toWord = to.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = amount.toString(16).padStart(64, '0');
  return `0x${selector}${toWord}${amountWord}`;
}

export function toHexQuantity(value: bigint): string {
  return `0x${value.toString(16)}`;
}
