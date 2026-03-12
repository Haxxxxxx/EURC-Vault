use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalCompleted;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

/// Emergency withdraw — user can always exit, even when vault is paused.
/// Withdraws entire deposit + pending rewards. No cooldown.
#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
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

    /// CHECK: PDA authority for the vault token account
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = vault_config.eurc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vault_config.eurc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    let deposit_amount = stake.deposited_amount;
    require!(deposit_amount > 0, VaultError::InsufficientBalance);

    // Calculate pending rewards
    let pending_rewards = math::calculate_pending_rewards(
        stake.deposited_amount,
        vault.accumulated_reward_per_share,
        stake.reward_debt,
    )?;

    let total_transfer = (deposit_amount as u128)
        .checked_add(pending_rewards as u128)
        .ok_or(VaultError::MathOverflow)? as u64;

    // Transfer everything back to user
    let vault_key = vault.key();
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault_key.as_ref(),
        &[vault.authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        ),
        total_transfer,
    )?;

    // Reset user state completely
    vault.total_deposits = vault
        .total_deposits
        .checked_sub(deposit_amount)
        .ok_or(VaultError::MathOverflow)?;
    vault.staker_count = vault.staker_count.saturating_sub(1);

    stake.deposited_amount = 0;
    stake.reward_debt = 0;
    stake.pending_withdrawal_amount = 0;
    stake.withdrawal_available_at = 0;
    stake.total_rewards_claimed = stake
        .total_rewards_claimed
        .checked_add(pending_rewards)
        .ok_or(VaultError::MathOverflow)?;
    stake.last_interaction_time = clock.unix_timestamp;

    emit!(WithdrawalCompleted {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount: deposit_amount,
        rewards_claimed: pending_rewards,
    });

    Ok(())
}
