use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct VaultConfig {
    /// Unique vault identifier
    pub vault_id: u64,

    /// Authority that can perform admin operations
    pub authority: Pubkey,

    /// Pending authority for 2-step transfer (Pubkey::default() if none)
    pub pending_authority: Pubkey,

    /// EURC mint address (validated at initialization)
    pub eurc_mint: Pubkey,

    /// PDA bump for the vault config
    pub bump: u8,

    /// PDA bump for the vault authority (token account owner)
    pub authority_bump: u8,

    /// PDA bump for the pbEURC mint authority
    pub pb_mint_auth_bump: u8,

    /// Whether the vault is paused (deposits blocked, withdrawals always allowed)
    pub paused: bool,

    /// Maximum EURC capacity in base units
    pub max_capacity: u64,

    /// pbEURC receipt token mint (per-vault, PDA)
    pub pb_eurc_mint: Pubkey,

    /// Total EURC held in vault (deposits + funded rewards)
    pub total_eurc_in_vault: u64,

    /// Total pbEURC supply minted
    pub total_pb_eurc_supply: u64,

    /// Cumulative rewards funded (analytics)
    pub total_rewards_funded: u64,

    /// Exchange rate: EURC per pbEURC, scaled by PRECISION (10^12). Starts at PRECISION (1:1)
    pub exchange_rate: u128,

    /// Current epoch number (starts at 1)
    pub current_epoch: u64,

    /// Epoch duration in seconds
    pub epoch_duration: i64,

    /// Timestamp when the current epoch started
    pub epoch_start_time: i64,

    /// Withdrawal cooldown period in seconds (0 = instant)
    pub withdrawal_cooldown: i64,

    /// Number of unique stakers
    pub staker_count: u64,
}

impl VaultConfig {
    // 8 (disc) + 8 + 32 + 32 + 32 + 1 + 1 + 1 + 1 + 8 + 32 + 8 + 8 + 8 + 16 + 8 + 8 + 8 + 8 + 8
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 1 + 1 + 1 + 1 + 8 + 32 + 8 + 8 + 8 + 16 + 8 + 8 + 8 + 8 + 8;
}
