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

    let withdrawal_eurc = stake.pending_withdrawal_eurc;
    require!(withdrawal_eurc > 0, VaultError::NoPendingWithdrawal);
    require!(
        clock.unix_timestamp >= stake.withdrawal_available_at,
        VaultError::WithdrawalCooldownActive
    );

    // Transfer locked EURC to user
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
        withdrawal_eurc,
    )?;

    // Update vault EURC total
    vault.total_eurc_in_vault = vault
        .total_eurc_in_vault
        .checked_sub(withdrawal_eurc)
        .ok_or(VaultError::MathOverflow)?;

    // Clear pending withdrawal
    stake.pending_withdrawal_eurc = 0;
    stake.pending_withdrawal_shares = 0;
    stake.withdrawal_available_at = 0;
    stake.last_interaction_time = clock.unix_timestamp;

    // Recalculate exchange rate
    if vault.total_pb_eurc_supply > 0 {
        vault.exchange_rate = math::calculate_exchange_rate(
            vault.total_eurc_in_vault,
            vault.total_pb_eurc_supply,
        )?;
    }

    // Decrement staker count if user has no more shares and no pending withdrawal
    // (check user's pbEURC balance would require passing in the token account — we skip for simplicity)

    emit!(WithdrawalCompleted {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        eurc_amount: withdrawal_eurc,
    });

    Ok(())
}
