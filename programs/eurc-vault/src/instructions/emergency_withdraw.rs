use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::EmergencyWithdrawalExecuted;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

/// Emergency withdraw — user can always exit, even when vault is paused.
/// Burns all pbEURC shares, returns EURC value + any pending withdrawal EURC. No cooldown.
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

    /// pbEURC mint (for burn)
    #[account(
        mut,
        address = vault_config.pb_eurc_mint,
    )]
    pub pb_eurc_mint: Account<'info, Mint>,

    /// User's pbEURC token account
    #[account(
        mut,
        token::mint = pb_eurc_mint,
        token::authority = user,
    )]
    pub user_pb_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    let user_shares = ctx.accounts.user_pb_token_account.amount;
    let pending_eurc = stake.pending_withdrawal_eurc;

    // User must have something to withdraw (shares or pending withdrawal)
    require!(
        user_shares > 0 || pending_eurc > 0,
        VaultError::InsufficientBalance
    );

    // Calculate EURC value of user's pbEURC shares
    let shares_eurc_value = if user_shares > 0 {
        math::shares_to_eurc(user_shares, vault.exchange_rate)?
    } else {
        0
    };

    // Total = pbEURC value + pending withdrawal EURC
    let total_eurc = shares_eurc_value
        .checked_add(pending_eurc)
        .ok_or(VaultError::MathOverflow)?;

    // Burn all pbEURC shares
    if user_shares > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.pb_eurc_mint.to_account_info(),
                    from: ctx.accounts.user_pb_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            user_shares,
        )?;

        vault.total_pb_eurc_supply = vault
            .total_pb_eurc_supply
            .checked_sub(user_shares)
            .ok_or(VaultError::MathOverflow)?;
    }

    // Transfer all EURC back to user
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
        total_eurc,
    )?;

    // Update vault state
    vault.total_eurc_in_vault = vault
        .total_eurc_in_vault
        .checked_sub(total_eurc)
        .ok_or(VaultError::MathOverflow)?;
    vault.staker_count = vault.staker_count.saturating_sub(1);

    // Recalculate exchange rate
    if vault.total_pb_eurc_supply > 0 {
        vault.exchange_rate = math::calculate_exchange_rate(
            vault.total_eurc_in_vault,
            vault.total_pb_eurc_supply,
        )?;
    }

    // Reset user state
    stake.pending_withdrawal_eurc = 0;
    stake.pending_withdrawal_shares = 0;
    stake.withdrawal_available_at = 0;
    stake.last_interaction_time = clock.unix_timestamp;

    emit!(EmergencyWithdrawalExecuted {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        total_eurc_returned: total_eurc,
        shares_burned: user_shares,
    });

    Ok(())
}
