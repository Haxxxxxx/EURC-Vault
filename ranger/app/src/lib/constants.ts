import { PublicKey } from '@solana/web3.js';

export const EURC_MINT = new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr');
export const EURC_DECIMALS = 6;
export const EURC_PRECISION = 1_000_000;

// Ranger Earn
export const VAULT_PROGRAM_ID = 'vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8';
export const ADAPTOR_IDS = {
  drift:  'EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP',
  kamino: 'to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR',
  save:   'aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz',
} as const;

export const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? '';

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const SOLANA_CLUSTER =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta';

// Strategy parameters (mirrors bot/config.ts)
export const REBALANCE_MIN_SPREAD_BPS = 50;
export const MAX_ALLOCATION_PCT = 0.70;
export const MIN_ALLOCATION_PCT = 0.10;
export const IDLE_RESERVE_PCT = 0.05;

// Fee parameters (mirrors bot/config.ts)
export const MGMT_FEE_BPS = 50;       // 0.5% annual management fee
export const PERF_FEE_BPS = 1_000;    // 10% performance fee (high-water mark)

// Explorer URL (consistent across the app)
export const EXPLORER_TX_URL = SOLANA_CLUSTER === 'devnet'
  ? 'https://solscan.io/tx/{sig}?cluster=devnet'
  : 'https://solscan.io/tx/{sig}';

/** Validate base58 tx signature and build explorer URL */
export function explorerTxUrl(sig: string): string {
  if (!/^[A-HJ-NP-Za-km-z1-9]{43,88}$/.test(sig)) return '#';
  return EXPLORER_TX_URL.replace('{sig}', sig);
}

// Protocol display metadata
export const PROTOCOL_META = {
  drift:  { label: 'Drift',  color: '#3B82F6', bgClass: 'bg-blue-500',    icon: 'drift'  },
  kamino: { label: 'Kamino', color: '#8B5CF6', bgClass: 'bg-violet-500',  icon: 'kamino' },
  save:   { label: 'Save',   color: '#10B981', bgClass: 'bg-emerald-500', icon: 'save'   },
  idle:   { label: 'Idle',   color: '#64748B', bgClass: 'bg-slate-500',   icon: 'idle'   },
} as const;
