import 'dotenv/config';
import { z } from 'zod';
import { buildRegistry, type AssetCode } from './assets.js';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),

  DATABASE_URL: z.string().min(1),
  /** disable | require (encrypted, certificate not verified) | verify (encrypted + verified) */
  DATABASE_SSL: z.enum(['disable', 'require', 'verify']).default('disable'),
  DATABASE_CA_CERT: z.string().optional(),

  /** Comma-separated browser origins. Empty = CORS off (a mobile app does not need it). */
  CORS_ORIGINS: z.string().default(''),

  /** Development only: trust the X-Ziarat-User-Id header. Refused when NODE_ENV=production. */
  ALLOW_DEV_AUTH: bool,

  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_WEBHOOK_SIGNING_KEY: z.string().min(1),
  PRIVY_AUTHORIZATION_PRIVATE_KEY: z.string().optional(),
  /** Ask Privy to sponsor gas so users need no native token for ERC-20 withdrawals. */
  PRIVY_SPONSOR_GAS: bool,

  ZIARAT_CHAIN_ID: z.coerce.number().int().default(11155111), // Sepolia unless you opt in to mainnet
  ZIARAT_ENABLED_ASSETS: z.string().default('ETH'),
  ZIARAT_USDT_CONTRACT: z.string().optional(),
  ZIARAT_USDC_CONTRACT: z.string().optional(),
  ZIARAT_ZIAR_CONTRACT: z.string().optional(),
  ZIARAT_USDT_DECIMALS: z.coerce.number().int().min(0).max(36).optional(),
  ZIARAT_USDC_DECIMALS: z.coerce.number().int().min(0).max(36).optional(),
  ZIARAT_ZIAR_DECIMALS: z.coerce.number().int().min(0).max(36).optional(),

  ZIARAT_WITHDRAWALS_ENABLED: bool,
  ZIARAT_REQUIRE_KYC: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** asset:perTx:perDay in human units, ';'-separated. Required for every enabled asset. */
  ZIARAT_WITHDRAW_LIMITS: z.string().default(''),
  /** Native-asset amount kept back for gas when withdrawing the native asset (ignored if sponsoring gas). */
  ZIARAT_NATIVE_GAS_RESERVE: z.string().regex(/^\d+(\.\d+)?$/).default('0.002'),

  /** Set true when running behind a load balancer so rate limits key on the real client IP. */
  TRUST_PROXY: bool,
  /** Operator API key (32+ chars). Unset = the /admin routes do not exist. Keep them off the public internet. */
  ADMIN_API_KEY: z.string().min(32).optional(),
  /** JSON-RPC endpoint for the configured chain. Required in production: settlement is verified on-chain. */
  ZIARAT_RPC_URL: z.string().url().optional(),
  /** Block confirmations required before a deposit is credited or a withdrawal is settled/refunded. */
  ZIARAT_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(500).default(12),
  /** A withdrawal still 'pending' after this long (crash mid-send) is moved to manual review. */
  ZIARAT_PENDING_TIMEOUT_SECONDS: z.coerce.number().int().min(60).default(300),
  /** A submitted withdrawal unknown to the chain after this long (dropped/replaced) goes to manual review. */
  ZIARAT_DROPPED_TX_SECONDS: z.coerce.number().int().min(300).default(3600),
  ZIARAT_RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid configuration:\n', parsed.error.format());
  process.exit(1);
}
export const env = parsed.data;

if (env.NODE_ENV === 'production' && env.ALLOW_DEV_AUTH) {
  console.error('Refusing to start: ALLOW_DEV_AUTH must be false in production.');
  process.exit(1);
}

if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (!env.PRIVY_AUTHORIZATION_PRIVATE_KEY) problems.push('PRIVY_AUTHORIZATION_PRIVATE_KEY is required (wallets must not be controllable with the app secret alone)');
  if (!env.ZIARAT_REQUIRE_KYC) problems.push('ZIARAT_REQUIRE_KYC must be true');
  if (env.DATABASE_SSL === 'disable') problems.push('DATABASE_SSL must be require or verify');
  if (!env.ZIARAT_RPC_URL) problems.push('ZIARAT_RPC_URL is required so deposits/withdrawals are verified on-chain');
  if (problems.length) {
    console.error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
}

const code = (c: AssetCode) => c;
export const registry = (() => {
  try {
    const reg = buildRegistry({
      chainId: env.ZIARAT_CHAIN_ID,
      enabled: env.ZIARAT_ENABLED_ASSETS.split(',').map((s) => s.trim()).filter(Boolean),
      contracts: {
        [code('USDT')]: env.ZIARAT_USDT_CONTRACT,
        [code('USDC')]: env.ZIARAT_USDC_CONTRACT,
        [code('ZIAR')]: env.ZIARAT_ZIAR_CONTRACT,
      },
      decimals: {
        [code('USDT')]: env.ZIARAT_USDT_DECIMALS,
        [code('USDC')]: env.ZIARAT_USDC_DECIMALS,
        [code('ZIAR')]: env.ZIARAT_ZIAR_DECIMALS,
      },
      limits: env.ZIARAT_WITHDRAW_LIMITS,
    });
    if (env.ZIARAT_WITHDRAWALS_ENABLED) {
      const missing = reg.filter((a) => !a.limits).map((a) => a.code);
      if (missing.length) throw new Error(`Withdrawals are enabled but limits are missing for: ${missing.join(', ')}`);
    }
    return reg;
  } catch (e) {
    console.error('Invalid asset configuration:', (e as Error).message);
    process.exit(1);
  }
})();
