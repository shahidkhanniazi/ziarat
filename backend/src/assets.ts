import { toMinor } from './amounts.js';

export type AssetCode = 'ETH' | 'USDT' | 'USDC' | 'ZIAR';

export interface AssetLimits {
  perTx: bigint;
  perDay: bigint;
}

export interface AssetDef {
  code: AssetCode;
  name: string;
  decimals: number;
  /** Token contract (lowercase) or null for the native asset. */
  contract: string | null;
  native: boolean;
  /** CAIP-2 chain id, e.g. eip155:11155111. Used as the ledger "network". */
  caip2: string;
  networkLabel: string;
  limits: AssetLimits | null;
}

export interface RegistryInput {
  chainId: number;
  enabled: string[];
  contracts: Partial<Record<AssetCode, string | undefined>>;
  decimals: Partial<Record<AssetCode, number | undefined>>;
  /** Format: "USDT:1000:5000;ETH:0.5:2" => asset:perTx:perDay (human units). */
  limits: string;
}

const NAMES: Record<AssetCode, string> = {
  ETH: 'Ethereum',
  USDT: 'Tether USD',
  USDC: 'USD Coin',
  ZIAR: 'ZIAR',
};
const DEFAULT_DECIMALS: Record<AssetCode, number> = { ETH: 18, USDT: 6, USDC: 6, ZIAR: 18 };
const CHAIN_LABELS: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Sepolia (testnet)',
  8453: 'Base',
  84532: 'Base Sepolia (testnet)',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'OP Mainnet',
};

function isAssetCode(v: string): v is AssetCode {
  return v === 'ETH' || v === 'USDT' || v === 'USDC' || v === 'ZIAR';
}

export function parseLimits(raw: string, decimalsByCode: Record<string, number>): Map<string, AssetLimits> {
  const out = new Map<string, AssetLimits>();
  for (const part of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [code, perTx, perDay] = part.split(':');
    if (!code || !perTx || !perDay) throw new Error(`Invalid limit entry "${part}". Use ASSET:perTx:perDay.`);
    const decimals = decimalsByCode[code.toUpperCase()];
    if (decimals === undefined) throw new Error(`Limit set for unknown asset "${code}".`);
    out.set(code.toUpperCase(), { perTx: toMinor(perTx, decimals), perDay: toMinor(perDay, decimals) });
  }
  return out;
}

export function buildRegistry(input: RegistryInput): AssetDef[] {
  const caip2 = `eip155:${input.chainId}`;
  const label = CHAIN_LABELS[input.chainId] ?? `EVM chain ${input.chainId}`;
  const decimalsByCode: Record<string, number> = {};
  for (const code of Object.keys(NAMES) as AssetCode[]) {
    decimalsByCode[code] = input.decimals[code] ?? DEFAULT_DECIMALS[code];
  }
  const limits = parseLimits(input.limits, decimalsByCode);

  return input.enabled.map((raw) => {
    const code = raw.trim().toUpperCase();
    if (code === 'BTC') {
      throw new Error('BTC is not supported in this release. Remove it from ZIARAT_ENABLED_ASSETS.');
    }
    if (!isAssetCode(code)) throw new Error(`Unknown asset "${raw}" in ZIARAT_ENABLED_ASSETS.`);

    const native = code === 'ETH';
    const contract = input.contracts[code]?.trim() ?? '';
    if (!native && !/^0x[0-9a-fA-F]{40}$/.test(contract)) {
      throw new Error(`${code} is enabled but its contract address is missing or invalid.`);
    }
    return {
      code,
      name: NAMES[code],
      decimals: decimalsByCode[code] as number,
      contract: native ? null : contract.toLowerCase(),
      native,
      caip2,
      networkLabel: label,
      limits: limits.get(code) ?? null,
    };
  });
}

export function findByCode(registry: AssetDef[], code: string): AssetDef | undefined {
  const c = code.toUpperCase();
  return registry.find((a) => a.code === c);
}

/**
 * Resolves a deposit to a configured asset by chain + contract address (never by symbol,
 * so a worthless token that merely calls itself "USDT" cannot be credited).
 */
export function findByDeposit(
  registry: AssetDef[],
  caip2: string,
  assetType: string,
  assetAddress: string | null,
): AssetDef | undefined {
  if (assetType === 'native-token' || assetType === 'native') {
    return registry.find((a) => a.native && a.caip2 === caip2);
  }
  if (!assetAddress) return undefined;
  const addr = assetAddress.toLowerCase();
  return registry.find((a) => !a.native && a.caip2 === caip2 && a.contract === addr);
}
