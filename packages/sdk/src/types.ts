import { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

// ---------------------------------------------------------------------------
// On-chain account types (mirror Rust state structs)
// ---------------------------------------------------------------------------

/**
 * Decoded VaultConfig account.
 *
 * PDA seeds: `["vault", vault_id.to_le_bytes()]`
 */
export interface VaultConfig {
  vaultId: BN;
  authority: PublicKey;
  pendingAuthority: PublicKey;
  eurcMint: PublicKey;
  bump: number;
  authorityBump: number;
  paused: boolean;
  maxCapacity: BN;
  totalDeposits: BN;
  totalRewardsDistributed: BN;
  accumulatedRewardPerShare: BN; // u128 on-chain, Anchor deserializes as BN
  currentEpoch: BN;
  epochDuration: BN;
  epochStartTime: BN;
  withdrawalCooldown: BN;
  stakerCount: BN;
}

/**
 * Decoded UserStake account.
 *
 * PDA seeds: `["user_stake", vault_config.key(), user.key()]`
 */
export interface UserStake {
  vault: PublicKey;
  user: PublicKey;
  bump: number;
  depositedAmount: BN;
  rewardDebt: BN; // u128 on-chain
  totalRewardsClaimed: BN;
  pendingWithdrawalAmount: BN;
  withdrawalAvailableAt: BN;
  firstDepositTime: BN;
  lastInteractionTime: BN;
}

/**
 * Decoded EpochSnapshot account.
 *
 * PDA seeds: `["epoch", vault_config.key(), epoch_number.to_le_bytes()]`
 */
export interface EpochSnapshot {
  vault: PublicKey;
  epochNumber: BN;
  bump: number;
  totalDeposits: BN;
  totalRewardsDistributed: BN;
  accumulatedRewardPerShare: BN; // u128 on-chain
  stakerCount: BN;
  startTime: BN;
  endTime: BN;
}

// ---------------------------------------------------------------------------
// PDA derivation result
// ---------------------------------------------------------------------------

export interface PdaResult {
  publicKey: PublicKey;
  bump: number;
}

// ---------------------------------------------------------------------------
// Instruction parameter types
// ---------------------------------------------------------------------------

export interface InitializeVaultParams {
  vaultId: number | BN;
  maxCapacity: number | BN;
  epochDuration: number | BN;
  withdrawalCooldown: number | BN;
  /** The EURC mint to use. Defaults to EURC_MINT_MAINNET. */
  eurcMint?: PublicKey;
}

export interface DepositParams {
  /** Amount in EURC base units (1 EURC = 1_000_000) */
  amount: number | BN;
}

export interface InitiateWithdrawalParams {
  /** Amount in EURC base units */
  amount: number | BN;
}

export interface FundRewardsParams {
  /** Amount in EURC base units */
  amount: number | BN;
}

export interface UpdateVaultConfigParams {
  newMaxCapacity?: number | BN | null;
  newEpochDuration?: number | BN | null;
  newWithdrawalCooldown?: number | BN | null;
}

export interface InitiateAuthorityTransferParams {
  newAuthority: PublicKey;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface EpochHistoryQuery {
  /** Starting epoch number (inclusive). Defaults to 1. */
  fromEpoch?: number;
  /** Ending epoch number (inclusive). Defaults to current_epoch - 1. */
  toEpoch?: number;
}

// ---------------------------------------------------------------------------
// Events (for parsing transaction logs)
// ---------------------------------------------------------------------------

export interface VaultInitializedEvent {
  vaultId: BN;
  authority: PublicKey;
  eurcMint: PublicKey;
  maxCapacity: BN;
  epochDuration: BN;
  withdrawalCooldown: BN;
}

export interface DepositedEvent {
  vault: PublicKey;
  user: PublicKey;
  amount: BN;
  totalDeposited: BN;
  rewardsClaimed: BN;
}

export interface WithdrawalInitiatedEvent {
  vault: PublicKey;
  user: PublicKey;
  amount: BN;
  availableAt: BN;
}

export interface WithdrawalCompletedEvent {
  vault: PublicKey;
  user: PublicKey;
  amount: BN;
  rewardsClaimed: BN;
}

export interface WithdrawalCancelledEvent {
  vault: PublicKey;
  user: PublicKey;
  amount: BN;
}

export interface RewardsClaimedEvent {
  vault: PublicKey;
  user: PublicKey;
  amount: BN;
}

export interface RewardsFundedEvent {
  vault: PublicKey;
  funder: PublicKey;
  amount: BN;
  newAccRewardPerShare: BN;
}

export interface EpochAdvancedEvent {
  vault: PublicKey;
  epochNumber: BN;
  totalDepositsSnapshot: BN;
  totalRewardsDistributed: BN;
}

export interface VaultConfigUpdatedEvent {
  vault: PublicKey;
  maxCapacity: BN;
  epochDuration: BN;
  withdrawalCooldown: BN;
}
