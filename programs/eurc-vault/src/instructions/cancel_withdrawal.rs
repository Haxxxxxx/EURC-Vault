use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalCancelled;
use crate::state::{VaultConfig, UserStake};

#[derive(Accounts)]
pub struct CancelWithdrawal<'info> {
    pub user: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [USER_STAKE_SEED, vault_config.key().as_ref(), user.key().as_ref()],
        bump = user_stake.bump,
    )]
    pub user_stake: Account<'info, UserStake>,
}

pub fn handler(ctx: Context<CancelWithdrawal>) -> Result<()> {
    let vault = &ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(stake.pending_withdrawal_amount > 0, VaultError::NoPendingWithdrawalToCancel);

    let cancelled_amount = stake.pending_withdrawal_amount;
    stake.pending_withdrawal_amount = 0;
    stake.withdrawal_available_at = 0;
    stake.last_interaction_time = clock.unix_timestamp;

    emit!(WithdrawalCancelled {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount: cancelled_amount,
    });

    Ok(())
}
