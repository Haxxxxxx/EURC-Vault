/**
 * Central configuration for the EURC Cross-Protocol Yield Optimizer.
 * All tuneable parameters live here; override via environment variables.
 */
import 'dotenv/config';

// ─── Program / Adaptor IDs ───────────────────────────────────────────────────

export const VAULT_PROGRAM_ID = 'vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8';

/** Ranger Earn adaptor IDs (deployed by Ranger, not us) */
export const ADAPTOR_IDS = {
  lending: 'aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz', // Save/Lending
  drift:   'EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP',
  kamino:  'to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR',
} as const;

// ─── Asset ───────────────────────────────────────────────────────────────────

export const EURC_MINT_MAINNET = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';
/** USDC used as devnet proxy when EURC markets are unavailable */
export const USDC_MINT_DEVNET = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

export const EURC_DECIMALS = 6;
export const EURC_PRECISION = 10 ** EURC_DECIMALS;

/** Active mint based on cluster (EURC mainnet, USDC devnet fallback) */
export const ACTIVE_MINT =
  process.env.EURC_MINT ??
  (process.env.SOLANA_CLUSTER === 'mainnet-beta' ? EURC_MINT_MAINNET : USDC_MINT_DEVNET);

// ─── RPC / Cluster ───────────────────────────────────────────────────────────

export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const SOLANA_CLUSTER = (process.env.SOLANA_CLUSTER ?? 'devnet') as
  | 'devnet'
  | 'mainnet-beta';

// ─── Vault Addresses (populated after create-vault) ─────────────────────────

export const VAULT_ADDRESS = process.env.VAULT_ADDRESS ?? '';
export const VAULT_ADMIN_KEYPAIR_PATH = process.env.VAULT_ADMIN_KEYPAIR_PATH ?? '';
export const VAULT_MANAGER_KEYPAIR_PATH = process.env.VAULT_MANAGER_KEYPAIR_PATH ?? '';

// ─── Vault Creation Parameters ───────────────────────────────────────────────

export const VAULT_MGMT_FEE_BPS = 50;          // 0.5% annual management fee
export const VAULT_PERF_FEE_BPS = 1000;        // 10% performance fee (high-water mark)
export const VAULT_MAX_CAPACITY = 1_000_000 * EURC_PRECISION; // 1M EURC
export const VAULT_WITHDRAWAL_WAIT_PERIOD_SECONDS = 86_400;   // 24 hours

// ─── Strategy Parameters ─────────────────────────────────────────────────────

/** Minimum rate spread (in bps) between best and worst protocol to trigger rebalance */
export const REBALANCE_MIN_SPREAD_BPS = parseInt(
  process.env.REBALANCE_MIN_SPREAD_BPS ?? '50',
  10,
);

/** Maximum fraction of TVL allowed in any single protocol (default 70%) */
export const MAX_ALLOCATION_PCT =
  parseInt(process.env.MAX_ALLOCATION_PCT ?? '70', 10) / 100;

/** Minimum fraction of TVL required in any active protocol (default 10%) */
export const MIN_ALLOCATION_PCT =
  parseInt(process.env.MIN_ALLOCATION_PCT ?? '10', 10) / 100;

/** Fraction of TVL kept idle as withdrawal liquidity buffer (default 5%) */
export const IDLE_RESERVE_PCT =
  parseInt(process.env.IDLE_RESERVE_PCT ?? '5', 10) / 100;

/** Minimum ms between rebalance executions (default 30 min) */
export const REBALANCE_COOLDOWN_MS = parseInt(
  process.env.REBALANCE_COOLDOWN_MS ?? '1800000',
  10,
);

/** Max fraction of TVL moved in a single rebalance cycle */
export const MAX_REBALANCE_PCT_PER_CYCLE = 0.30;

/** Minimum accrued interest before compounding in EURC atoms (default 10 EURC) */
export const COMPOUND_MIN_AMOUNT = parseInt(
  process.env.COMPOUND_MIN_AMOUNT ?? '10000000',
  10,
);

// ─── Risk Parameters ─────────────────────────────────────────────────────────

/** Max drawdown fraction from peak TVL before circuit breaker trips (default 2%) */
export const CIRCUIT_BREAKER_DRAWDOWN_PCT =
  parseFloat(process.env.CIRCUIT_BREAKER_DRAWDOWN_PCT ?? '2') / 100;

/** Max protocol utilization ratio before we avoid supplying further */
export const MAX_UTILIZATION = 0.85;

/** Max ms a rate can be before it's treated as stale */
export const RATE_STALENESS_MS = 10 * 60 * 1_000; // 10 min

/** Reject rate if it deviates > 50% from 7-day MA (oracle sanity check) */
export const RATE_ORACLE_DEVIATION_LIMIT = 0.50;

// ─── Bot Intervals ───────────────────────────────────────────────────────────

export const RATE_FETCH_INTERVAL_MS     = 5  * 60 * 1_000; // 5 min
export const REBALANCE_INTERVAL_MS      = 15 * 60 * 1_000; // 15 min
export const COMPOUND_INTERVAL_MS       = 60 * 60 * 1_000; // 1 hour
export const HEALTH_CHECK_INTERVAL_MS  =  5 * 60 * 1_000;  // 5 min
export const METRICS_SNAP_INTERVAL_MS  = 15 * 60 * 1_000;  // 15 min

// ─── Protocol-specific Config ────────────────────────────────────────────────

/** Drift spot market index for EURC/USDC (mainnet) */
export const DRIFT_SPOT_MARKET_INDEX = parseInt(
  process.env.DRIFT_SPOT_MARKET_INDEX ?? '15',
  10,
);

/** Drift oracle address for the EURC spot market */
export const DRIFT_ORACLE_ADDRESS = process.env.DRIFT_ORACLE_ADDRESS ?? '';

/** Kamino EURC reserve address (mainnet) */
export const KAMINO_RESERVE_ADDRESS =
  process.env.KAMINO_RESERVE_ADDRESS ?? '';

/** Save (Solend) EURC reserve address (mainnet) */
export const SAVE_RESERVE_ADDRESS =
  process.env.SAVE_RESERVE_ADDRESS ?? '';

/** Save (Solend) EURC lending market (default: Solend main market) */
export const SAVE_LENDING_MARKET =
  process.env.SAVE_LENDING_MARKET ?? '4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY';

/** Save (Solend) EURC reserve liquidity supply (counterPartyTa) */
export const SAVE_COUNTERPARTY_TA = process.env.SAVE_COUNTERPARTY_TA ?? '';

/** Save (Solend) EURC collateral mint */
export const SAVE_COLLATERAL_MINT = process.env.SAVE_COLLATERAL_MINT ?? '';

/** Save (Solend) EURC Pyth oracle */
export const SAVE_PYTH_ORACLE = process.env.SAVE_PYTH_ORACLE ?? '';

/** Save (Solend) EURC Switchboard oracle */
export const SAVE_SWITCHBOARD_ORACLE = process.env.SAVE_SWITCHBOARD_ORACLE ?? '';

// ─── Strategy Addresses (populated after init-strategies.ts runs) ────────────

/** Strategy account addresses for each protocol (set in .env after init-strategies) */
export const DRIFT_STRATEGY_ADDRESS  = process.env.DRIFT_STRATEGY_ADDRESS  ?? '';
export const KAMINO_STRATEGY_ADDRESS = process.env.KAMINO_STRATEGY_ADDRESS ?? '';
export const SAVE_STRATEGY_ADDRESS   = process.env.SAVE_STRATEGY_ADDRESS   ?? '';

export const STRATEGY_ADDRESSES: Record<string, string> = {
  drift:  DRIFT_STRATEGY_ADDRESS,
  kamino: KAMINO_STRATEGY_ADDRESS,
  save:   SAVE_STRATEGY_ADDRESS,
};

// ─── Firebase ────────────────────────────────────────────────────────────────

export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? '';
export const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '';

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const DISCORD_WEBHOOK_URL  = process.env.DISCORD_WEBHOOK_URL  ?? '';
export const TELEGRAM_BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN   ?? '';
export const TELEGRAM_CHAT_ID     = process.env.TELEGRAM_CHAT_ID     ?? '';

// ─── Voltr API ───────────────────────────────────────────────────────────────

export const VOLTR_API_BASE = 'https://api.voltr.xyz';
