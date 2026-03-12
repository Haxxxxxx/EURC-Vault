import { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

// ---------------------------------------------------------------------------
// On-chain account types (mirror Rust state structs)
// ---------------------------------------------------------------------------

/**
 * Decoded VaultConfig account — pbEURC receipt token model.
 */
export interface VaultConfig {
  vaultId: BN;
  authority: PublicKey;
  pendingAuthority: PublicKey;
  eurcMint: PublicKey;
  bump: number;
  authorityBump: number;
  pbMintAuthBump: number;
  paused: boolean;
  maxCapacity: BN;
  pbEurcMint: PublicKey;
  totalEurcInVault: BN;
  totalPbEurcSupply: BN;
  totalRewardsFunded: BN;
  exchangeRate: BN; // u128 on-chain, Anchor deserializes as BN
  currentEpoch: BN;
  epochDuration: BN;
  epochStartTime: BN;
  withdrawalCooldown: BN;
  stakerCount: BN;
}

/**
 * Decoded UserStake account — pbEURC model.
 */
export interface UserStake {
  vault: PublicKey;
  user: PublicKey;
  bump: number;
  pendingWithdrawalEurc: BN;
  pendingWithdrawalShares: BN;
  withdrawalAvailableAt: BN;
  firstDepositTime: BN;
  lastInteractionTime: BN;
}

/**
 * Decoded EpochSnapshot account — pbEURC model.
 */
export interface EpochSnapshot {
  vault: PublicKey;
  epochNumber: BN;
  bump: number;
  totalEurcInVault: BN;
  totalPbEurcSupply: BN;
  exchangeRate: BN; // u128 on-chain
  rewardsFundedThisEpoch: BN;
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
  pbEurcMint: PublicKey;
  maxCapacity: BN;
  epochDuration: BN;
  withdrawalCooldown: BN;
}

export interface DepositedEvent {
  vault: PublicKey;
  user: PublicKey;
  eurcAmount: BN;
  sharesMinted: BN;
  exchangeRate: BN;
}

export interface WithdrawalInitiatedEvent {
  vault: PublicKey;
  user: PublicKey;
  eurcAmount: BN;
  sharesBurned: BN;
  exchangeRate: BN;
  availableAt: BN;
}

export interface WithdrawalCompletedEvent {
  vault: PublicKey;
  user: PublicKey;
  eurcAmount: BN;
}

export interface WithdrawalCancelledEvent {
  vault: PublicKey;
  user: PublicKey;
  eurcAmount: BN;
  sharesReminted: BN;
  exchangeRate: BN;
}

export interface RewardsFundedEvent {
  vault: PublicKey;
  funder: PublicKey;
  amount: BN;
  newExchangeRate: BN;
}

export interface EpochAdvancedEvent {
  vault: PublicKey;
  epochNumber: BN;
  exchangeRate: BN;
  totalEurcInVault: BN;
  totalPbEurcSupply: BN;
}

export interface VaultConfigUpdatedEvent {
  vault: PublicKey;
  maxCapacity: BN;
  epochDuration: BN;
  withdrawalCooldown: BN;
}

export interface EmergencyWithdrawalExecutedEvent {
  vault: PublicKey;
  user: PublicKey;
  totalEurcReturned: BN;
  sharesBurned: BN;
}
