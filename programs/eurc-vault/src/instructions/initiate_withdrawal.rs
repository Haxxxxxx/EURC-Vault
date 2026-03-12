use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalInitiated;
use crate::state::{VaultConfig, UserStake};

#[derive(Accounts)]
pub struct InitiateWithdrawal<'info> {
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

pub fn handler(ctx: Context<InitiateWithdrawal>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(amount > 0, VaultError::ZeroWithdrawal);
    require!(stake.pending_withdrawal_amount == 0, VaultError::WithdrawalAlreadyPending);
    require!(amount <= stake.deposited_amount, VaultError::InsufficientBalance);

    let available_at = if vault.withdrawal_cooldown == 0 {
        clock.unix_timestamp
    } else {
        clock.unix_timestamp
            .checked_add(vault.withdrawal_cooldown)
            .ok_or(VaultError::MathOverflow)?
    };

    stake.pending_withdrawal_amount = amount;
    stake.withdrawal_available_at = available_at;
    stake.last_interaction_time = clock.unix_timestamp;

    emit!(WithdrawalInitiated {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount,
        available_at,
    });

    Ok(())
}
