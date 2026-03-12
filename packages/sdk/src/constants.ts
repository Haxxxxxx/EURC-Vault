import { PublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

/** Placeholder program ID -- replace with deployed address */
export const PROGRAM_ID = new PublicKey(
  "EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1",
);

// ---------------------------------------------------------------------------
// PDA seeds (must match on-chain constants.rs)
// ---------------------------------------------------------------------------

export const VAULT_SEED = Buffer.from("vault");
export const USER_STAKE_SEED = Buffer.from("user_stake");
export const EPOCH_SEED = Buffer.from("epoch");
export const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");
export const PB_EURC_MINT_SEED = Buffer.from("pbeurc_mint");
export const PB_EURC_MINT_AUTH_SEED = Buffer.from("pbeurc_mint_auth");

// ---------------------------------------------------------------------------
// Numeric constants
// ---------------------------------------------------------------------------

/** Precision multiplier for exchange_rate (10^12) */
export const PRECISION = BigInt("1000000000000"); // 10^12

/** Initial exchange rate: 1 pbEURC = 1 EURC */
export const INITIAL_EXCHANGE_RATE = PRECISION;

/** EURC uses 6 decimal places */
export const EURC_DECIMALS = 6;

/** pbEURC uses 6 decimal places (matches EURC) */
export const PB_EURC_DECIMALS = 6;

/** 1 EURC in base units */
export const ONE_EURC = BigInt(10 ** EURC_DECIMALS); // 1_000_000n

/** EURC mint on mainnet (Circle) */
export const EURC_MINT_MAINNET = new PublicKey(
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
);

/** Default max vault capacity: 10,000,000 EURC */
export const DEFAULT_MAX_CAPACITY = BigInt("10000000000000"); // 10^13 base units

/** Default epoch duration: 48 hours in seconds */
export const DEFAULT_EPOCH_DURATION = 48 * 60 * 60; // 172_800

/** Default withdrawal cooldown: 1 day in seconds */
export const DEFAULT_WITHDRAWAL_COOLDOWN = 24 * 60 * 60; // 86_400

/** Minimum deposit: 1 EURC */
export const MIN_DEPOSIT = BigInt("1000000"); // 10^6 base units

/** Maximum vault ID */
export const MAX_VAULT_ID = 10_000;

/** Seconds per year for APY calculations */
export const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
