use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::VaultError;
use crate::events::EpochAdvanced;
use crate::state::{VaultConfig, EpochSnapshot};

#[derive(Accounts)]
pub struct AdvanceEpoch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault_config.vault_id.to_le_bytes().as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init,
        payer = authority,
        space = EpochSnapshot::LEN,
        seeds = [
            EPOCH_SEED,
            vault_config.key().as_ref(),
            vault_config.current_epoch.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub epoch_snapshot: Account<'info, EpochSnapshot>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AdvanceEpoch>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    let snapshot = &mut ctx.accounts.epoch_snapshot;
    let clock = Clock::get()?;

    // Validate epoch has ended
    let epoch_end_time = vault
        .epoch_start_time
        .checked_add(vault.epoch_duration)
        .ok_or(VaultError::MathOverflow)?;
    require!(clock.unix_timestamp >= epoch_end_time, VaultError::EpochNotEnded);

    // Create epoch snapshot
    snapshot.vault = vault.key();
    snapshot.epoch_number = vault.current_epoch;
    snapshot.bump = ctx.bumps.epoch_snapshot;
    snapshot.total_deposits = vault.total_deposits;
    snapshot.total_rewards_distributed = vault.total_rewards_distributed;
    snapshot.accumulated_reward_per_share = vault.accumulated_reward_per_share;
    snapshot.staker_count = vault.staker_count;
    snapshot.start_time = vault.epoch_start_time;
    snapshot.end_time = clock.unix_timestamp;
    snapshot._reserved = [0u8; 64];

    let completed_epoch = vault.current_epoch;

    // Advance to next epoch
    vault.current_epoch = vault
        .current_epoch
        .checked_add(1)
        .ok_or(VaultError::MathOverflow)?;
    vault.epoch_start_time = clock.unix_timestamp;

    emit!(EpochAdvanced {
        vault: vault.key(),
        epoch_number: completed_epoch,
        total_deposits_snapshot: snapshot.total_deposits,
        total_rewards_distributed: snapshot.total_rewards_distributed,
    });

    Ok(())
}
