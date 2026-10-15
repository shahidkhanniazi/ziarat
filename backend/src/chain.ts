import { env } from './config.js';
import { interpretReceipt, isTxHash, type TxState } from './chain-rules.js';

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  if (!env.ZIARAT_RPC_URL) throw new Error('ZIARAT_RPC_URL is not configured.');
  const res = await fetch(env.ZIARAT_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(`RPC error: ${body.error.message ?? 'unknown'}`);
  return body.result;
}

/** Looks the transaction up on-chain. Throws on RPC failure (callers must treat that as "unknown", never as "failed"). */
export async function getTxState(hash: string): Promise<TxState> {
  if (!isTxHash(hash)) throw new Error('Invalid transaction hash.');
  const [receipt, latest] = await Promise.all([rpc('eth_getTransactionReceipt', [hash]), rpc('eth_blockNumber', [])]);
  if (typeof latest !== 'string' || !/^0x[0-9a-fA-F]+$/.test(latest)) throw new Error('Unreadable block number.');
  return interpretReceipt(receipt, BigInt(latest));
}
