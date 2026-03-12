use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

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
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA used as token account authority — validated by seeds
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The EURC mint
    pub eurc_mint: Account<'info, Mint>,

    /// Vault's EURC token account, owned by the vault_authority PDA
    #[account(
        init,
        payer = authority,
        associated_token::mint = eurc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
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
    vault.paused = false;
    vault.max_capacity = max_capacity;
    vault.total_deposits = 0;
    vault.total_rewards_distributed = 0;
    vault.accumulated_reward_per_share = 0;
    vault.current_epoch = 1;
    vault.epoch_duration = epoch_duration;
    vault.epoch_start_time = clock.unix_timestamp;
    vault.withdrawal_cooldown = withdrawal_cooldown;
    vault.staker_count = 0;
    vault._reserved = [0u8; 128];

    emit!(VaultInitialized {
        vault_id,
        authority: ctx.accounts.authority.key(),
        eurc_mint: ctx.accounts.eurc_mint.key(),
        max_capacity,
        epoch_duration,
        withdrawal_cooldown,
    });

    Ok(())
}
