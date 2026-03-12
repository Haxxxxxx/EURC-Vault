use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::WithdrawalCancelled;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

#[derive(Accounts)]
pub struct CancelWithdrawal<'info> {
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

    /// pbEURC mint (for re-minting)
    #[account(
        mut,
        address = vault_config.pb_eurc_mint,
    )]
    pub pb_eurc_mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority for pbEURC
    #[account(
        seeds = [PB_EURC_MINT_AUTH_SEED, vault_config.key().as_ref()],
        bump = vault_config.pb_mint_auth_bump,
    )]
    pub pb_mint_authority: UncheckedAccount<'info>,

    /// User's pbEURC token account (shares will be re-minted here)
    #[account(
        mut,
        token::mint = pb_eurc_mint,
        token::authority = user,
    )]
    pub user_pb_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelWithdrawal>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    require!(stake.pending_withdrawal_eurc > 0, VaultError::NoPendingWithdrawalToCancel);

    let pending_eurc = stake.pending_withdrawal_eurc;

    // Re-mint shares at CURRENT exchange rate (may be fewer shares if rate grew during cooldown)
    let new_shares = math::eurc_to_shares(pending_eurc, vault.exchange_rate)?;

    // Mint pbEURC back to user
    let vault_key = vault.key();
    let mint_seeds = &[
        PB_EURC_MINT_AUTH_SEED,
        vault_key.as_ref(),
        &[vault.pb_mint_auth_bump],
    ];
    let mint_signer = &[&mint_seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.pb_eurc_mint.to_account_info(),
                to: ctx.accounts.user_pb_token_account.to_account_info(),
                authority: ctx.accounts.pb_mint_authority.to_account_info(),
            },
            mint_signer,
        ),
        new_shares,
    )?;

    // Update vault supply
    vault.total_pb_eurc_supply = vault
        .total_pb_eurc_supply
        .checked_add(new_shares)
        .ok_or(VaultError::MathOverflow)?;

    // Recalculate exchange rate
    vault.exchange_rate = math::calculate_exchange_rate(
        vault.total_eurc_in_vault,
        vault.total_pb_eurc_supply,
    )?;

    // Clear pending withdrawal
    stake.pending_withdrawal_eurc = 0;
    stake.pending_withdrawal_shares = 0;
    stake.withdrawal_available_at = 0;
    stake.last_interaction_time = clock.unix_timestamp;

    emit!(WithdrawalCancelled {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        eurc_amount: pending_eurc,
        shares_reminted: new_shares,
        exchange_rate: vault.exchange_rate,
    });

    Ok(())
}
