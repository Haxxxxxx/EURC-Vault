use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct EpochSnapshot {
    /// The vault this snapshot belongs to
    pub vault: Pubkey,

    /// Epoch number
    pub epoch_number: u64,

    /// PDA bump
    pub bump: u8,

    /// Total deposits at epoch end (base units)
    pub total_deposits: u64,

    /// Total rewards distributed during this epoch (base units)
    pub total_rewards_distributed: u64,

    /// Accumulated reward per share at epoch end
    pub accumulated_reward_per_share: u128,

    /// Number of stakers at epoch end
    pub staker_count: u64,

    /// Epoch start timestamp
    pub start_time: i64,

    /// Epoch end timestamp
    pub end_time: i64,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl EpochSnapshot {
    /// Account size: 8 (discriminator) + fields
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 8 + 16 + 8 + 8 + 8 + 64;
}
