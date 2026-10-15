import { parseBaseUnits } from './amounts.js';
import { MalformedEventError } from './errors.js';

export interface ParsedDeposit {
  eventId: string;
  walletId: string;
  caip2: string;
  assetType: string;
  assetAddress: string | null;
  /** Amount in base units (wei etc.). Privy sends base units, NOT decimals. */
  amount: bigint;
  txHash: string;
  recipient: string | null;
  sender: string | null;
}

export interface ParsedWithdrawal {
  eventId: string;
  walletId: string;
  txHash: string;
}

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Privy documents a flat payload; some surfaces wrap it as { event, data }. Accept both. */
function unwrap(payload: unknown): { type: string; body: Obj } | null {
  const root = asObj(payload);
  if (!root) return null;
  const type = str(root.type) ?? str(root.event);
  if (!type) return null;
  const body = asObj(root.data) ?? root;
  return { type, body };
}

/** Returns null when the event is not a deposit. Throws when it is a deposit but malformed. */
export function parseDepositEvent(payload: unknown, fallbackEventId: string): ParsedDeposit | null {
  const u = unwrap(payload);
  if (!u || u.type !== 'wallet.funds_deposited') return null;
  const b = u.body;
  const asset = asObj(b.asset);
  const walletId = str(b.wallet_id);
  const caip2 = str(b.caip2);
  const txHash = str(b.transaction_hash);
  if (!walletId || !caip2 || !txHash || !asset) throw new MalformedEventError('Malformed deposit event.');
  return {
    eventId: str(b.idempotency_key) ?? fallbackEventId,
    walletId,
    caip2,
    assetType: str(asset.type) ?? 'unknown',
    assetAddress: str(asset.address),
    amount: baseUnits(b.amount),
    txHash,
    recipient: str(b.recipient),
    sender: str(b.sender),
  };
}

export function parseWithdrawalEvent(payload: unknown, fallbackEventId: string): ParsedWithdrawal | null {
  const u = unwrap(payload);
  if (!u || u.type !== 'wallet.funds_withdrawn') return null;
  const walletId = str(u.body.wallet_id);
  const txHash = str(u.body.transaction_hash);
  if (!walletId || !txHash) throw new MalformedEventError('Malformed withdrawal event.');
  return { eventId: str(u.body.idempotency_key) ?? fallbackEventId, walletId, txHash };
}

function baseUnits(value: unknown): bigint {
  try {
    return parseBaseUnits(value);
  } catch (e) {
    throw new MalformedEventError((e as Error).message);
  }
}
