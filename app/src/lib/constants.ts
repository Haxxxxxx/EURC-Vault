import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('HVau1t6oBx4J9XwBYcHo7Vk7KUxDJ1KFH9Yqx6V7pump');

export const RPC_ENDPOINTS = {
  devnet: process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
  mainnet: process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
};

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || 'devnet') as 'devnet' | 'mainnet';

export const EURC_MINT = new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr');

export const EURC_DECIMALS = 6;

export const VAULT_CONFIGS = {
  STANDARD: {
    id: 'standard',
    name: 'Standard Vault',
    description: 'Low-risk, steady returns with 7-day withdrawal period',
    apy: 4.5,
    capacity: 10_000_000 * Math.pow(10, EURC_DECIMALS),
    withdrawalCooldown: 7 * 24 * 60 * 60,
    minDeposit: 100 * Math.pow(10, EURC_DECIMALS),
    maxDeposit: 100_000 * Math.pow(10, EURC_DECIMALS),
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium Vault',
    description: 'Higher returns with 14-day withdrawal period',
    apy: 7.2,
    capacity: 5_000_000 * Math.pow(10, EURC_DECIMALS),
    withdrawalCooldown: 14 * 24 * 60 * 60,
    minDeposit: 1_000 * Math.pow(10, EURC_DECIMALS),
    maxDeposit: 250_000 * Math.pow(10, EURC_DECIMALS),
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise Vault',
    description: 'Maximum returns for institutional stakers with 30-day withdrawal',
    apy: 12.8,
    capacity: 50_000_000 * Math.pow(10, EURC_DECIMALS),
    withdrawalCooldown: 30 * 24 * 60 * 60,
    minDeposit: 10_000 * Math.pow(10, EURC_DECIMALS),
    maxDeposit: 1_000_000 * Math.pow(10, EURC_DECIMALS),
  },
};

export const EPOCH_DURATION = 30 * 24 * 60 * 60;

export const NAV_ITEMS = [
  { label: 'Portfolio', href: '/', icon: 'LayoutDashboard' },
  { label: 'Vaults', href: '/vaults', icon: 'Vault' },
  { label: 'History', href: '/history', icon: 'History' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  REWARD_CLAIM: 'reward_claim',
  COOLDOWN_STARTED: 'cooldown_started',
  COOLDOWN_CANCELLED: 'cooldown_cancelled',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;
