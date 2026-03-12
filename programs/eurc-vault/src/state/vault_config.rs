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

    /// Whether the vault is paused (deposits blocked, withdrawals always allowed)
    pub paused: bool,

    /// Maximum EURC capacity in base units
    pub max_capacity: u64,

    /// Total EURC currently deposited by all users (base units)
    pub total_deposits: u64,

    /// Total rewards ever distributed (base units, for accounting)
    pub total_rewards_distributed: u64,

    /// Accumulated reward per share (u128, scaled by PRECISION = 10^12)
    /// This is the MasterChef-style global accumulator
    pub accumulated_reward_per_share: u128,

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

    /// Reserved space for future upgrades
    pub _reserved: [u8; 128],
}

impl VaultConfig {
    /// Account size: 8 (discriminator) + fields
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 1 + 1 + 1 + 8 + 8 + 8 + 16 + 8 + 8 + 8 + 8 + 8 + 128;
}
