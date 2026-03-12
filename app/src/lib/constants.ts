import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1');

export const RPC_ENDPOINTS = {
  devnet: process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
  mainnet: process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
};

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || 'devnet') as 'devnet' | 'mainnet';

/** Mainnet EURC mint — for devnet testing, use TEST_EURC_MINT instead */
export const EURC_MINT = new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr');

/** Test EURC mint on devnet (6 decimals, same as real EURC) */
export const TEST_EURC_MINT = new PublicKey('3G8zXbwK4wUkCa3hS6q1NtCPgBvHWnbJu6A3iqDTxFTq');

export const EURC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Vault Registry — maps URL slugs to on-chain vault IDs + static metadata
// ---------------------------------------------------------------------------

export interface VaultRegistryEntry {
  slug: string;
  onChainId: number;
  name: string;
  description: string;
  risk: 'Very Low' | 'Low' | 'Medium' | 'High';
  riskVariant: 'success' | 'warning' | 'info';
  lockPeriodLabel: string;
  minDepositLabel: string;
  /** Minimum deposit in base units (EURC has 6 decimals, so 100 EURC = 100_000_000) */
  minDeposit: number;
}

export const VAULT_REGISTRY: VaultRegistryEntry[] = [
  {
    slug: 'main-eurc-stability',
    onChainId: 1,
    name: 'Main EURC Stability',
    description: 'Low-risk vault with steady returns. Ideal for long-term EURC holders seeking reliable yield.',
    risk: 'Low',
    riskVariant: 'success',
    lockPeriodLabel: '7 days',
    minDepositLabel: '100 EURC',
    minDeposit: 100_000_000,
  },
  {
    slug: 'high-yield',
    onChainId: 2,
    name: 'High Yield EURC',
    description: 'Enhanced returns with moderate risk exposure. Diversified yield strategies for higher APY.',
    risk: 'Medium',
    riskVariant: 'warning',
    lockPeriodLabel: '14 days',
    minDepositLabel: '500 EURC',
    minDeposit: 500_000_000,
  },
  {
    slug: 'premium-locked',
    onChainId: 3,
    name: 'Premium Locked',
    description: 'Maximum returns with a 30-day lock period. Best for committed stakers seeking top-tier yield.',
    risk: 'Medium',
    riskVariant: 'warning',
    lockPeriodLabel: '30 days',
    minDepositLabel: '1,000 EURC',
    minDeposit: 1_000_000_000,
  },
  {
    slug: 'conservative',
    onChainId: 4,
    name: 'Conservative Reserve',
    description: 'Ultra-safe vault with minimal risk. Capital preservation focused with modest, stable returns.',
    risk: 'Very Low',
    riskVariant: 'success',
    lockPeriodLabel: '3 days',
    minDepositLabel: '50 EURC',
    minDeposit: 50_000_000,
  },
];

export function getVaultBySlug(slug: string): VaultRegistryEntry | undefined {
  return VAULT_REGISTRY.find((v) => v.slug === slug);
}

export function getVaultByOnChainId(id: number): VaultRegistryEntry | undefined {
  return VAULT_REGISTRY.find((v) => v.onChainId === id);
}

// ---------------------------------------------------------------------------
// Mock fallback data (used when program is not deployed)
// ---------------------------------------------------------------------------

export const MOCK_VAULT_DATA: Record<string, {
  apy: number;
  tvl: number;
  capacity: number;
  stakerCount: number;
  currentEpoch: number;
  epochDuration: number;
  epochStartTime: number;
  withdrawalCooldown: number;
  exchangeRate: number;
  totalPbEurcSupply: number;
  totalRewardsFunded: number;
}> = {
  'main-eurc-stability': {
    apy: 8.45,
    tvl: 12_400_000_000_000,
    capacity: 20_000_000_000_000,
    stakerCount: 1_247,
    currentEpoch: 43,
    epochDuration: 48 * 60 * 60,
    epochStartTime: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
    withdrawalCooldown: 24 * 60 * 60,
    exchangeRate: 1_045_000_000_000,
    totalPbEurcSupply: 11_866_000_000_000,
    totalRewardsFunded: 534_000_000_000,
  },
  'high-yield': {
    apy: 12.8,
    tvl: 8_200_000_000_000,
    capacity: 15_000_000_000_000,
    stakerCount: 834,
    currentEpoch: 28,
    epochDuration: 48 * 60 * 60,
    epochStartTime: Math.floor(Date.now() / 1000) - 36 * 60 * 60,
    withdrawalCooldown: 48 * 60 * 60,
    exchangeRate: 1_082_000_000_000,
    totalPbEurcSupply: 7_578_000_000_000,
    totalRewardsFunded: 622_000_000_000,
  },
  'premium-locked': {
    apy: 15.5,
    tvl: 5_600_000_000_000,
    capacity: 10_000_000_000_000,
    stakerCount: 412,
    currentEpoch: 15,
    epochDuration: 48 * 60 * 60,
    epochStartTime: Math.floor(Date.now() / 1000) - 12 * 60 * 60,
    withdrawalCooldown: 72 * 60 * 60,
    exchangeRate: 1_115_000_000_000,
    totalPbEurcSupply: 5_022_000_000_000,
    totalRewardsFunded: 578_000_000_000,
  },
  'conservative': {
    apy: 5.2,
    tvl: 18_900_000_000_000,
    capacity: 30_000_000_000_000,
    stakerCount: 2_103,
    currentEpoch: 62,
    epochDuration: 48 * 60 * 60,
    epochStartTime: Math.floor(Date.now() / 1000) - 6 * 60 * 60,
    withdrawalCooldown: 24 * 60 * 60,
    exchangeRate: 1_025_000_000_000,
    totalPbEurcSupply: 18_439_000_000_000,
    totalRewardsFunded: 461_000_000_000,
  },
};

// ---------------------------------------------------------------------------
// Navigation & enums (unchanged)
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  { label: 'Portfolio', href: '/', icon: 'LayoutDashboard' },
  { label: 'Vaults', href: '/vaults', icon: 'Vault' },
  { label: 'History', href: '/history', icon: 'History' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  COOLDOWN_STARTED: 'cooldown_started',
  COOLDOWN_CANCELLED: 'cooldown_cancelled',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;
