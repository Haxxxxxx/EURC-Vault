use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::RewardsFunded;
use crate::state::VaultConfig;
use crate::utils::math;

#[derive(Accounts)]
pub struct FundRewards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,

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

    /// Authority's EURC token account (source of rewards)
    #[account(
        mut,
        token::mint = vault_config.eurc_mint,
        token::authority = authority,
    )]
    pub funder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;

    require!(amount > 0, VaultError::ZeroRewardFund);
    require!(vault.total_pb_eurc_supply > 0, VaultError::NoActiveStakers);

    // Transfer EURC from funder to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.funder_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update vault EURC total — supply stays the same, so exchange rate grows
    vault.total_eurc_in_vault = vault
        .total_eurc_in_vault
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    vault.total_rewards_funded = vault
        .total_rewards_funded
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    // Recalculate exchange rate
    vault.exchange_rate = math::calculate_exchange_rate(
        vault.total_eurc_in_vault,
        vault.total_pb_eurc_supply,
    )?;

    emit!(RewardsFunded {
        vault: vault.key(),
        funder: ctx.accounts.authority.key(),
        amount,
        new_exchange_rate: vault.exchange_rate,
    });

    Ok(())
}
