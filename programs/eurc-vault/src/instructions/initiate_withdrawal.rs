use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Burn};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalInitiated;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

#[derive(Accounts)]
pub struct InitiateWithdrawal<'info> {
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

    /// pbEURC mint (for burn)
    #[account(
        mut,
        address = vault_config.pb_eurc_mint,
    )]
    pub pb_eurc_mint: Account<'info, Mint>,

    /// User's pbEURC token account (shares will be burned from here)
    #[account(
        mut,
        token::mint = pb_eurc_mint,
        token::authority = user,
    )]
    pub user_pb_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<InitiateWithdrawal>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(amount > 0, VaultError::ZeroWithdrawal);
    require!(stake.pending_withdrawal_eurc == 0, VaultError::WithdrawalAlreadyPending);

    // Calculate how many shares to burn for the requested EURC amount
    let shares_to_burn = math::eurc_to_shares(amount, vault.exchange_rate)?;
    require!(shares_to_burn > 0, VaultError::ZeroWithdrawal);

    // Verify user has enough pbEURC shares
    let user_shares = ctx.accounts.user_pb_token_account.amount;
    require!(user_shares >= shares_to_burn, VaultError::InsufficientShares);

    // Burn pbEURC shares from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.pb_eurc_mint.to_account_info(),
                from: ctx.accounts.user_pb_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        shares_to_burn,
    )?;

    // Update vault supply (EURC stays in vault until complete_withdrawal)
    vault.total_pb_eurc_supply = vault
        .total_pb_eurc_supply
        .checked_sub(shares_to_burn)
        .ok_or(VaultError::MathOverflow)?;

    let available_at = if vault.withdrawal_cooldown == 0 {
        clock.unix_timestamp
    } else {
        clock.unix_timestamp
            .checked_add(vault.withdrawal_cooldown)
            .ok_or(VaultError::MathOverflow)?
    };

    // Store pending withdrawal info
    stake.pending_withdrawal_eurc = amount;
    stake.pending_withdrawal_shares = shares_to_burn;
    stake.withdrawal_available_at = available_at;
    stake.last_interaction_time = clock.unix_timestamp;

    // Recalculate exchange rate (EURC unchanged, supply decreased — rate should stay same or increase slightly due to rounding)
    if vault.total_pb_eurc_supply > 0 {
        vault.exchange_rate = math::calculate_exchange_rate(
            vault.total_eurc_in_vault,
            vault.total_pb_eurc_supply,
        )?;
    }

    emit!(WithdrawalInitiated {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        eurc_amount: amount,
        shares_burned: shares_to_burn,
        exchange_rate: vault.exchange_rate,
        available_at,
    });

    Ok(())
}
