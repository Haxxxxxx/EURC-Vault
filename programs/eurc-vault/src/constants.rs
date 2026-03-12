/// PDA seed for VaultConfig
pub const VAULT_SEED: &[u8] = b"vault";

/// PDA seed for UserStake
pub const USER_STAKE_SEED: &[u8] = b"user_stake";

/// PDA seed for EpochSnapshot
pub const EPOCH_SEED: &[u8] = b"epoch";

/// PDA seed for VaultAuthority (PDA that owns the token account)
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

/// PDA seed for pbEURC mint (per-vault receipt token)
pub const PB_EURC_MINT_SEED: &[u8] = b"pbeurc_mint";

/// PDA seed for pbEURC mint authority
pub const PB_EURC_MINT_AUTH_SEED: &[u8] = b"pbeurc_mint_auth";

/// pbEURC decimals (matches EURC)
pub const PB_EURC_DECIMALS: u8 = 6;

/// EURC mint on mainnet (Circle)
/// HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr
pub const EURC_MINT_MAINNET: [u8; 32] = [
    0xfa, 0xc1, 0x28, 0x49, 0x43, 0xef, 0x8e, 0xc2, 0x56, 0x4c, 0xd0, 0xba, 0x88, 0x7e, 0xc5,
    0x48, 0x8b, 0x75, 0xaa, 0x9e, 0x48, 0x1c, 0x91, 0xb8, 0xf5, 0xc3, 0xd4, 0x68, 0x8f, 0xea,
    0x4d, 0x49,
];

/// EURC decimals
pub const EURC_DECIMALS: u8 = 6;

/// Precision multiplier for exchange_rate (10^12)
pub const PRECISION: u128 = 1_000_000_000_000;

/// Initial exchange rate: 1 pbEURC = 1 EURC (scaled by PRECISION)
pub const INITIAL_EXCHANGE_RATE: u128 = PRECISION;

/// Default max vault capacity: 10,000,000 EURC = 10^13 base units
pub const DEFAULT_MAX_CAPACITY: u64 = 10_000_000_000_000;

/// Default epoch duration: 48 hours in seconds
pub const DEFAULT_EPOCH_DURATION: i64 = 48 * 60 * 60;

/// Default withdrawal cooldown: 1 day in seconds
pub const DEFAULT_WITHDRAWAL_COOLDOWN: i64 = 24 * 60 * 60;

/// Minimum deposit: 1 EURC (10^6 base units)
pub const MIN_DEPOSIT: u64 = 1_000_000;

/// Maximum vault ID (for bounds checking)
pub const MAX_VAULT_ID: u64 = 10_000;
