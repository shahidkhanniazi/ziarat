import { PrivyClient } from '@privy-io/node';
import { Webhook } from 'svix';
import { env } from './config.js';

export const privy = new PrivyClient({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });

/**
 * Everything that touches the Privy SDK lives in this file, so SDK upgrades never touch business logic.
 * After `npm install`, run `npm run typecheck`: the compiler will flag any SDK signature that differs.
 */
export async function createEvmWallet(externalId: string): Promise<{ id: string; address: string }> {
  const wallet = await privy.wallets().create({ chain_type: 'ethereum', external_id: externalId });
  return { id: wallet.id, address: wallet.address };
}

export interface EvmTransaction {
  to: string;
  value?: string; // hex quantity
  data?: string; // hex calldata
}

export async function sendEvmTransaction(
  walletId: string,
  caip2: string,
  transaction: EvmTransaction,
): Promise<{ hash: string }> {
  const input: Record<string, unknown> = { caip2, params: { transaction } };
  if (env.PRIVY_SPONSOR_GAS) input.sponsor = true;
  if (env.PRIVY_AUTHORIZATION_PRIVATE_KEY) {
    input.authorization_context = { authorization_private_keys: [env.PRIVY_AUTHORIZATION_PRIVATE_KEY] };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privy.wallets() as any).ethereum().sendTransaction(walletId, input);
  const hash = result?.hash ?? result?.transaction_hash;
  if (typeof hash !== 'string' || !hash) throw new Error('Privy returned no transaction hash.');
  return { hash };
}

/** Returns the Privy user id (did:privy:...) for a valid access token; throws otherwise. */
export async function verifyAccessToken(token: string): Promise<string> {
  const claims = await privy.utils().auth().verifyAccessToken(token);
  return claims.user_id;
}

/** Privy webhooks are signed with Svix. `raw` must be the exact, unparsed request body. */
export function verifyWebhook(raw: string, headers: { id: string; timestamp: string; signature: string }): unknown {
  const wh = new Webhook(env.PRIVY_WEBHOOK_SIGNING_KEY);
  return wh.verify(raw, {
    'svix-id': headers.id,
    'svix-timestamp': headers.timestamp,
    'svix-signature': headers.signature,
  });
}
