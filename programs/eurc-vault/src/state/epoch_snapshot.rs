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

    /// Total EURC held in vault at epoch end
    pub total_eurc_in_vault: u64,

    /// Total pbEURC supply at epoch end
    pub total_pb_eurc_supply: u64,

    /// Exchange rate at epoch end (scaled by PRECISION)
    pub exchange_rate: u128,

    /// Rewards funded during this epoch (cumulative snapshot)
    pub rewards_funded_this_epoch: u64,

    /// Number of stakers at epoch end
    pub staker_count: u64,

    /// Epoch start timestamp
    pub start_time: i64,

    /// Epoch end timestamp
    pub end_time: i64,
}

impl EpochSnapshot {
    // 8 (discriminator) + 32 + 8 + 1 + 8 + 8 + 16 + 8 + 8 + 8 + 8
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 8 + 16 + 8 + 8 + 8 + 8;
}
