use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

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
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserStake::LEN,
        seeds = [USER_STAKE_SEED, vault_config.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_stake: Account<'info, UserStake>,

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
    pub vault_token_account: Account<'info, TokenAccount>,

    /// User's EURC token account
    #[account(
        mut,
        token::mint = vault_config.eurc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

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
        vault.total_deposits.checked_add(amount).ok_or(VaultError::MathOverflow)? <= vault.max_capacity,
        VaultError::VaultCapacityExceeded
    );

    // Auto-claim pending rewards before updating deposit
    let rewards_claimed = if stake.deposited_amount > 0 {
        let pending = math::calculate_pending_rewards(
            stake.deposited_amount,
            vault.accumulated_reward_per_share,
            stake.reward_debt,
        )?;

        if pending > 0 {
            // Transfer rewards from vault to user
            let vault_key = vault.key();
            let seeds = &[
                VAULT_AUTHORITY_SEED,
                vault_key.as_ref(),
                &[vault.authority_bump],
            ];
            let signer_seeds = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                pending,
            )?;

            stake.total_rewards_claimed = stake
                .total_rewards_claimed
                .checked_add(pending)
                .ok_or(VaultError::MathOverflow)?;

            pending
        } else {
            0
        }
    } else {
        // First deposit — initialize stake metadata
        stake.vault = vault.key();
        stake.user = ctx.accounts.user.key();
        stake.bump = ctx.bumps.user_stake;
        stake.first_deposit_time = clock.unix_timestamp;
        stake._reserved = [0u8; 64];

        vault.staker_count = vault.staker_count.checked_add(1).ok_or(VaultError::MathOverflow)?;

        0
    };

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

    // Update state
    stake.deposited_amount = stake
        .deposited_amount
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;
    stake.reward_debt = math::calculate_reward_debt(
        stake.deposited_amount,
        vault.accumulated_reward_per_share,
    )?;
    stake.last_interaction_time = clock.unix_timestamp;

    vault.total_deposits = vault
        .total_deposits
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    emit!(Deposited {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount,
        total_deposited: stake.deposited_amount,
        rewards_claimed,
    });

    Ok(())
}
