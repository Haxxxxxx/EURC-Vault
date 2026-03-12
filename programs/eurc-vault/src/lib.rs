use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1");

#[program]
pub mod eurc_vault {
    use super::*;

    /// Initialize a new EURC vault with pbEURC receipt token
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_id: u64,
        max_capacity: u64,
        epoch_duration: i64,
        withdrawal_cooldown: i64,
    ) -> Result<()> {
        instructions::initialize_vault::handler(
            ctx,
            vault_id,
            max_capacity,
            epoch_duration,
            withdrawal_cooldown,
        )
    }

    /// Deposit EURC into the vault — receives pbEURC shares at current exchange rate
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Initiate a withdrawal (burns pbEURC shares, starts cooldown)
    pub fn initiate_withdrawal(ctx: Context<InitiateWithdrawal>, amount: u64) -> Result<()> {
        instructions::initiate_withdrawal::handler(ctx, amount)
    }

    /// Complete a withdrawal after cooldown has elapsed
    pub fn complete_withdrawal(ctx: Context<CompleteWithdrawal>) -> Result<()> {
        instructions::complete_withdrawal::handler(ctx)
    }

    /// Cancel a pending withdrawal (re-mints pbEURC at current exchange rate)
    pub fn cancel_withdrawal(ctx: Context<CancelWithdrawal>) -> Result<()> {
        instructions::cancel_withdrawal::handler(ctx)
    }

    /// Admin: Fund rewards pool (adds EURC to vault, exchange rate grows)
    pub fn fund_rewards(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
        instructions::fund_rewards::handler(ctx, amount)
    }

    /// Admin: Advance to next epoch (creates snapshot)
    pub fn advance_epoch(ctx: Context<AdvanceEpoch>) -> Result<()> {
        instructions::advance_epoch::handler(ctx)
    }

    /// Admin: Update vault configuration parameters
    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        new_max_capacity: Option<u64>,
        new_epoch_duration: Option<i64>,
        new_withdrawal_cooldown: Option<i64>,
    ) -> Result<()> {
        instructions::update_vault_config::handler(
            ctx,
            new_max_capacity,
            new_epoch_duration,
            new_withdrawal_cooldown,
        )
    }

    /// Admin: Toggle vault paused state
    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        instructions::toggle_pause::handler(ctx)
    }

    /// Admin: Initiate 2-step authority transfer
    pub fn initiate_authority_transfer(
        ctx: Context<InitiateAuthorityTransfer>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::transfer_authority::initiate_handler(ctx, new_authority)
    }

    /// Accept authority transfer (called by new authority)
    pub fn accept_authority_transfer(ctx: Context<AcceptAuthorityTransfer>) -> Result<()> {
        instructions::transfer_authority::accept_handler(ctx)
    }

    /// Emergency withdraw — always available, bypasses cooldown and pause
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        instructions::emergency_withdraw::handler(ctx)
    }
}
