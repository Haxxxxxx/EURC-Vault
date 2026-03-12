use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault_id: u64,
    pub authority: Pubkey,
    pub eurc_mint: Pubkey,
    pub max_capacity: u64,
    pub epoch_duration: i64,
    pub withdrawal_cooldown: i64,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub rewards_claimed: u64,
}

#[event]
pub struct WithdrawalInitiated {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub available_at: i64,
}

#[event]
pub struct WithdrawalCompleted {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub rewards_claimed: u64,
}

#[event]
pub struct WithdrawalCancelled {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RewardsClaimed {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RewardsFunded {
    pub vault: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    pub new_acc_reward_per_share: u128,
}

#[event]
pub struct EpochAdvanced {
    pub vault: Pubkey,
    pub epoch_number: u64,
    pub total_deposits_snapshot: u64,
    pub total_rewards_distributed: u64,
}

#[event]
pub struct VaultConfigUpdated {
    pub vault: Pubkey,
    pub max_capacity: u64,
    pub epoch_duration: i64,
    pub withdrawal_cooldown: i64,
}
