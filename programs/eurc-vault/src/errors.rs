use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Vault is paused — deposits are disabled")]
    VaultPaused,

    #[msg("Vault has reached maximum capacity")]
    VaultCapacityExceeded,

    #[msg("Deposit amount is below the minimum")]
    DepositTooSmall,

    #[msg("Deposit amount is zero")]
    ZeroDeposit,

    #[msg("Withdrawal amount exceeds deposited balance")]
    InsufficientBalance,

    #[msg("Withdrawal amount is zero")]
    ZeroWithdrawal,

    #[msg("Withdrawal is still in cooldown period")]
    WithdrawalCooldownActive,

    #[msg("No pending withdrawal to complete")]
    NoPendingWithdrawal,

    #[msg("No pending withdrawal to cancel")]
    NoPendingWithdrawalToCancel,

    #[msg("User already has a pending withdrawal")]
    WithdrawalAlreadyPending,

    #[msg("No rewards to claim")]
    NoRewardsToClaim,

    #[msg("Reward fund amount is zero")]
    ZeroRewardFund,

    #[msg("Epoch has not ended yet")]
    EpochNotEnded,

    #[msg("Invalid epoch number")]
    InvalidEpochNumber,

    #[msg("Unauthorized — caller is not the vault authority")]
    Unauthorized,

    #[msg("Invalid EURC mint address")]
    InvalidMint,

    #[msg("Arithmetic overflow in reward calculation")]
    MathOverflow,

    #[msg("Invalid vault configuration parameter")]
    InvalidConfig,

    #[msg("Vault capacity must be greater than total deposits")]
    CapacityBelowDeposits,

    #[msg("Authority transfer not initiated")]
    NoAuthorityTransferPending,

    #[msg("Caller is not the pending authority")]
    NotPendingAuthority,

    #[msg("Epoch duration must be positive")]
    InvalidEpochDuration,
}
