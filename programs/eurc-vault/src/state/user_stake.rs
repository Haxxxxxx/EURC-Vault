use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct UserStake {
    /// The vault this stake belongs to
    pub vault: Pubkey,

    /// The user who owns this stake
    pub user: Pubkey,

    /// PDA bump
    pub bump: u8,

    /// EURC value locked during pending withdrawal (at initiation-time exchange rate)
    pub pending_withdrawal_eurc: u64,

    /// pbEURC shares burned when withdrawal was initiated (for cancel recomputation)
    pub pending_withdrawal_shares: u64,

    /// Timestamp when pending withdrawal becomes available (0 if none)
    pub withdrawal_available_at: i64,

    /// Timestamp of first deposit
    pub first_deposit_time: i64,

    /// Timestamp of last interaction (deposit, withdraw)
    pub last_interaction_time: i64,
}

impl UserStake {
    // 8 (discriminator) + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8;
}
