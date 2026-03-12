use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::VaultInitialized;
use crate::state::VaultConfig;

#[derive(Accounts)]
#[instruction(vault_id: u64)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = VaultConfig::LEN,
        seeds = [VAULT_SEED, vault_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA used as token account authority — validated by seeds
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The EURC mint
    pub eurc_mint: Box<Account<'info, Mint>>,

    /// Vault's EURC token account — must be created client-side (ATA for vault_authority + eurc_mint)
    #[account(
        mut,
        token::mint = eurc_mint,
        token::authority = vault_authority,
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    /// pbEURC receipt token mint (PDA per vault)
    #[account(
        init,
        payer = authority,
        mint::decimals = PB_EURC_DECIMALS,
        mint::authority = pb_mint_authority,
        seeds = [PB_EURC_MINT_SEED, vault_config.key().as_ref()],
        bump,
    )]
    pub pb_eurc_mint: Box<Account<'info, Mint>>,

    /// CHECK: PDA used as pbEURC mint authority — validated by seeds
    #[account(
        seeds = [PB_EURC_MINT_AUTH_SEED, vault_config.key().as_ref()],
        bump,
    )]
    pub pb_mint_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    vault_id: u64,
    max_capacity: u64,
    epoch_duration: i64,
    withdrawal_cooldown: i64,
) -> Result<()> {
    require!(vault_id <= MAX_VAULT_ID, VaultError::InvalidConfig);
    require!(max_capacity > 0, VaultError::InvalidConfig);
    require!(epoch_duration > 0, VaultError::InvalidEpochDuration);
    require!(withdrawal_cooldown >= 0, VaultError::InvalidConfig);
    require!(ctx.accounts.eurc_mint.decimals == EURC_DECIMALS, VaultError::InvalidMint);

    let vault = &mut ctx.accounts.vault_config;
    let clock = Clock::get()?;

    vault.vault_id = vault_id;
    vault.authority = ctx.accounts.authority.key();
    vault.pending_authority = Pubkey::default();
    vault.eurc_mint = ctx.accounts.eurc_mint.key();
    vault.bump = ctx.bumps.vault_config;
    vault.authority_bump = ctx.bumps.vault_authority;
    vault.pb_mint_auth_bump = ctx.bumps.pb_mint_authority;
    vault.paused = false;
    vault.max_capacity = max_capacity;
    vault.pb_eurc_mint = ctx.accounts.pb_eurc_mint.key();
    vault.total_eurc_in_vault = 0;
    vault.total_pb_eurc_supply = 0;
    vault.total_rewards_funded = 0;
    vault.exchange_rate = INITIAL_EXCHANGE_RATE;
    vault.current_epoch = 1;
    vault.epoch_duration = epoch_duration;
    vault.epoch_start_time = clock.unix_timestamp;
    vault.withdrawal_cooldown = withdrawal_cooldown;
    vault.staker_count = 0;

    emit!(VaultInitialized {
        vault_id,
        authority: ctx.accounts.authority.key(),
        eurc_mint: ctx.accounts.eurc_mint.key(),
        pb_eurc_mint: ctx.accounts.pb_eurc_mint.key(),
        max_capacity,
        epoch_duration,
        withdrawal_cooldown,
    });

    Ok(())
}
