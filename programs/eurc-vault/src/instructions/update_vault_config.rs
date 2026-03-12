use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::VaultConfigUpdated;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

pub fn handler(
    ctx: Context<UpdateVaultConfig>,
    new_max_capacity: Option<u64>,
    new_epoch_duration: Option<i64>,
    new_withdrawal_cooldown: Option<i64>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;

    if let Some(capacity) = new_max_capacity {
        require!(capacity >= vault.total_deposits, VaultError::CapacityBelowDeposits);
        vault.max_capacity = capacity;
    }

    if let Some(duration) = new_epoch_duration {
        require!(duration > 0, VaultError::InvalidEpochDuration);
        vault.epoch_duration = duration;
    }

    if let Some(cooldown) = new_withdrawal_cooldown {
        require!(cooldown >= 0, VaultError::InvalidConfig);
        vault.withdrawal_cooldown = cooldown;
    }

    emit!(VaultConfigUpdated {
        vault: vault.key(),
        max_capacity: vault.max_capacity,
        epoch_duration: vault.epoch_duration,
        withdrawal_cooldown: vault.withdrawal_cooldown,
    });

    Ok(())
}
