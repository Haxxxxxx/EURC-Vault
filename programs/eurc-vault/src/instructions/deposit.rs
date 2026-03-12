use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::Deposited;
use crate::state::{VaultConfig, UserStake};
use crate::utils::math;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserStake::LEN,
        seeds = [USER_STAKE_SEED, vault_config.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_stake: Box<Account<'info, UserStake>>,

    /// CHECK: PDA authority for the vault token account
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's EURC token account
    #[account(
        mut,
        associated_token::mint = vault_config.eurc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    /// User's EURC token account
    #[account(
        mut,
        token::mint = vault_config.eurc_mint,
        token::authority = user,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    /// pbEURC receipt token mint
    #[account(
        mut,
        address = vault_config.pb_eurc_mint,
    )]
    pub pb_eurc_mint: Box<Account<'info, Mint>>,

    /// CHECK: PDA mint authority for pbEURC
    #[account(
        seeds = [PB_EURC_MINT_AUTH_SEED, vault_config.key().as_ref()],
        bump = vault_config.pb_mint_auth_bump,
    )]
    pub pb_mint_authority: UncheckedAccount<'info>,

    /// User's pbEURC token account (ATA — must be created client-side before deposit)
    #[account(
        mut,
        token::mint = pb_eurc_mint,
        token::authority = user,
    )]
    pub user_pb_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    // Validations
    require!(!vault.paused, VaultError::VaultPaused);
    require!(amount > 0, VaultError::ZeroDeposit);
    require!(amount >= MIN_DEPOSIT, VaultError::DepositTooSmall);
    require!(
        vault.total_eurc_in_vault.checked_add(amount).ok_or(VaultError::MathOverflow)? <= vault.max_capacity,
        VaultError::VaultCapacityExceeded
    );

    // Calculate shares to mint at current exchange rate
    let shares_to_mint = math::eurc_to_shares(amount, vault.exchange_rate)?;
    require!(shares_to_mint > 0, VaultError::DepositTooSmall);

    // Initialize user stake if first deposit
    if stake.first_deposit_time == 0 {
        stake.vault = vault.key();
        stake.user = ctx.accounts.user.key();
        stake.bump = ctx.bumps.user_stake;
        stake.first_deposit_time = clock.unix_timestamp;

        vault.staker_count = vault.staker_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
    }

    // Transfer EURC from user to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Mint pbEURC shares to user
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
        shares_to_mint,
    )?;

    // Update vault state
    vault.total_eurc_in_vault = vault
        .total_eurc_in_vault
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;
    vault.total_pb_eurc_supply = vault
        .total_pb_eurc_supply
        .checked_add(shares_to_mint)
        .ok_or(VaultError::MathOverflow)?;

    // Recalculate exchange rate
    vault.exchange_rate = math::calculate_exchange_rate(
        vault.total_eurc_in_vault,
        vault.total_pb_eurc_supply,
    )?;

    stake.last_interaction_time = clock.unix_timestamp;

    emit!(Deposited {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        eurc_amount: amount,
        shares_minted: shares_to_mint,
        exchange_rate: vault.exchange_rate,
    });

    Ok(())
}
