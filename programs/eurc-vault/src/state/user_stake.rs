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

    /// Amount of EURC currently deposited (base units)
    pub deposited_amount: u64,

    /// Reward debt = deposited_amount * accumulated_reward_per_share / PRECISION
    /// at the time of last deposit/claim. Used for MasterChef reward math.
    pub reward_debt: u128,

    /// Total rewards ever claimed by this user (base units)
    pub total_rewards_claimed: u64,

    /// Pending withdrawal amount (0 if no withdrawal pending)
    pub pending_withdrawal_amount: u64,

    /// Timestamp when pending withdrawal becomes available (0 if none)
    pub withdrawal_available_at: i64,

    /// Timestamp of first deposit
    pub first_deposit_time: i64,

    /// Timestamp of last interaction (deposit, withdraw, claim)
    pub last_interaction_time: i64,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl UserStake {
    /// Account size: 8 (discriminator) + fields
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 16 + 8 + 8 + 8 + 8 + 8 + 64;
}
