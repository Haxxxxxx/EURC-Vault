use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault_id: u64,
    pub authority: Pubkey,
    pub eurc_mint: Pubkey,
    pub pb_eurc_mint: Pubkey,
    pub max_capacity: u64,
    pub epoch_duration: i64,
    pub withdrawal_cooldown: i64,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub eurc_amount: u64,
    pub shares_minted: u64,
    pub exchange_rate: u128,
}

#[event]
pub struct WithdrawalInitiated {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub eurc_amount: u64,
    pub shares_burned: u64,
    pub exchange_rate: u128,
    pub available_at: i64,
}

#[event]
pub struct WithdrawalCompleted {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub eurc_amount: u64,
}

#[event]
pub struct WithdrawalCancelled {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub eurc_amount: u64,
    pub shares_reminted: u64,
    pub exchange_rate: u128,
}

#[event]
pub struct RewardsFunded {
    pub vault: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    pub new_exchange_rate: u128,
}

#[event]
pub struct EpochAdvanced {
    pub vault: Pubkey,
    pub epoch_number: u64,
    pub exchange_rate: u128,
    pub total_eurc_in_vault: u64,
    pub total_pb_eurc_supply: u64,
}

#[event]
pub struct VaultConfigUpdated {
    pub vault: Pubkey,
    pub max_capacity: u64,
    pub epoch_duration: i64,
    pub withdrawal_cooldown: i64,
}

#[event]
pub struct VaultPauseToggled {
    pub vault: Pubkey,
    pub paused: bool,
}

#[event]
pub struct AuthorityTransferInitiated {
    pub vault: Pubkey,
    pub current_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub vault: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct EmergencyWithdrawalExecuted {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub total_eurc_returned: u64,
    pub shares_burned: u64,
}
