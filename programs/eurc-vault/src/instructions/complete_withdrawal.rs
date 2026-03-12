use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalCompleted;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

#[derive(Accounts)]
pub struct CompleteWithdrawal<'info> {
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

pub fn handler(ctx: Context<CompleteWithdrawal>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    let withdrawal_amount = stake.pending_withdrawal_amount;
    require!(withdrawal_amount > 0, VaultError::NoPendingWithdrawal);
    require!(
        clock.unix_timestamp >= stake.withdrawal_available_at,
        VaultError::WithdrawalCooldownActive
    );

    // Calculate and claim pending rewards before withdrawal
    let pending_rewards = math::calculate_pending_rewards(
        stake.deposited_amount,
        vault.accumulated_reward_per_share,
        stake.reward_debt,
    )?;

    let total_transfer = (withdrawal_amount as u128)
        .checked_add(pending_rewards as u128)
        .ok_or(VaultError::MathOverflow)? as u64;

    // Transfer withdrawal + rewards from vault to user
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

    // Update state
    stake.deposited_amount = stake
        .deposited_amount
        .checked_sub(withdrawal_amount)
        .ok_or(VaultError::MathOverflow)?;
    stake.pending_withdrawal_amount = 0;
    stake.withdrawal_available_at = 0;
    stake.reward_debt = math::calculate_reward_debt(
        stake.deposited_amount,
        vault.accumulated_reward_per_share,
    )?;
    stake.total_rewards_claimed = stake
        .total_rewards_claimed
        .checked_add(pending_rewards)
        .ok_or(VaultError::MathOverflow)?;
    stake.last_interaction_time = clock.unix_timestamp;

    vault.total_deposits = vault
        .total_deposits
        .checked_sub(withdrawal_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Decrement staker count if fully withdrawn
    if stake.deposited_amount == 0 {
        vault.staker_count = vault.staker_count.saturating_sub(1);
    }

    emit!(WithdrawalCompleted {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount: withdrawal_amount,
        rewards_claimed: pending_rewards,
    });

    Ok(())
}
