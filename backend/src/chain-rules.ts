/** Pure decision logic for on-chain settlement. No I/O, so it is fully unit-testable. */

export type TxState =
  | { state: 'not_found' }
  | { state: 'reverted'; confirmations: bigint }
  | { state: 'success'; confirmations: bigint };

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
export const isTxHash = (v: string): boolean => HASH_RE.test(v);

function hexToBigInt(v: unknown): bigint | null {
  return typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v) ? BigInt(v) : null;
}

/** Interprets an eth_getTransactionReceipt result against the latest block number. */
export function interpretReceipt(receipt: unknown, latestBlock: bigint): TxState {
  if (receipt === null || receipt === undefined) return { state: 'not_found' };
  const r = receipt as { status?: unknown; blockNumber?: unknown };
  const block = hexToBigInt(r.blockNumber);
  const status = hexToBigInt(r.status);
  if (block === null || status === null) throw new Error('Unreadable transaction receipt.');
  const confirmations = latestBlock >= block ? latestBlock - block + 1n : 0n;
  return status === 1n ? { state: 'success', confirmations } : { state: 'reverted', confirmations };
}

export type DepositAction = 'credit' | 'fail' | 'wait';
export function decideDeposit(s: TxState, minConfirmations: number): DepositAction {
  if (s.state === 'not_found') return 'wait';
  if (s.confirmations < BigInt(minConfirmations)) return 'wait';
  return s.state === 'success' ? 'credit' : 'fail';
}

export type WithdrawalAction = 'confirm' | 'refund' | 'review' | 'wait';
/**
 * A reverted or successful result is acted on only after enough confirmations (a shallow reorg must not
 * trigger a refund). A transaction that is still unknown after dropAfterSeconds was dropped or replaced:
 * it goes to human review, never to an automatic refund.
 */
export function decideSubmittedWithdrawal(
  s: TxState,
  ageSeconds: number,
  minConfirmations: number,
  dropAfterSeconds: number,
): WithdrawalAction {
  if (s.state === 'not_found') return ageSeconds > dropAfterSeconds ? 'review' : 'wait';
  if (s.confirmations < BigInt(minConfirmations)) return 'wait';
  return s.state === 'success' ? 'confirm' : 'refund';
}
