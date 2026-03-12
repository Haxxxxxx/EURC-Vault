use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::state::VaultConfig;

/// Step 1: Current authority initiates transfer
#[derive(Accounts)]
pub struct InitiateAuthorityTransfer<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

/// Step 2: New authority accepts transfer
#[derive(Accounts)]
pub struct AcceptAuthorityTransfer<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

pub fn initiate_handler(
    ctx: Context<InitiateAuthorityTransfer>,
    new_authority: Pubkey,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    vault.pending_authority = new_authority;

    msg!("Authority transfer initiated to: {}", new_authority);

    Ok(())
}

pub fn accept_handler(ctx: Context<AcceptAuthorityTransfer>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;

    require!(
        vault.pending_authority != Pubkey::default(),
        VaultError::NoAuthorityTransferPending
    );
    require!(
        vault.pending_authority == ctx.accounts.new_authority.key(),
        VaultError::NotPendingAuthority
    );

    vault.authority = vault.pending_authority;
    vault.pending_authority = Pubkey::default();

    msg!("Authority transferred to: {}", vault.authority);

    Ok(())
}
