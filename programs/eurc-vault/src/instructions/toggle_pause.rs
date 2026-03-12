use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct TogglePause<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

pub fn handler(ctx: Context<TogglePause>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    vault.paused = !vault.paused;

    msg!("Vault paused: {}", vault.paused);

    Ok(())
}
