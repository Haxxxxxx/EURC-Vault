// ---------------------------------------------------------------------------
// @eurc-vault/sdk — public API
// ---------------------------------------------------------------------------

// Client
export { EurcVaultClient } from "./client";

// IDL
export { IDL } from "./idl";
export type { EurcVault } from "./idl";

// PDA derivation
export {
  findVaultConfigPda,
  findUserStakePda,
  findEpochSnapshotPda,
  findVaultAuthorityPda,
} from "./pda";

// Constants
export {
  PROGRAM_ID,
  VAULT_SEED,
  USER_STAKE_SEED,
  EPOCH_SEED,
  VAULT_AUTHORITY_SEED,
  PRECISION,
  EURC_DECIMALS,
  ONE_EURC,
  EURC_MINT_MAINNET,
  DEFAULT_MAX_CAPACITY,
  DEFAULT_EPOCH_DURATION,
  DEFAULT_WITHDRAWAL_COOLDOWN,
  MIN_DEPOSIT,
  MAX_VAULT_ID,
  SECONDS_PER_YEAR,
} from "./constants";

// Utilities
export {
  formatEurc,
  parseEurc,
  calculatePendingRewards,
  calculateApy,
  calculateProjectedEarnings,
  getEpochProgress,
  getEpochTimeRemaining,
  getWithdrawalTimeRemaining,
} from "./utils";

// Types
export type {
  VaultConfig,
  UserStake,
  EpochSnapshot,
  PdaResult,
  InitializeVaultParams,
  DepositParams,
  InitiateWithdrawalParams,
  FundRewardsParams,
  UpdateVaultConfigParams,
  InitiateAuthorityTransferParams,
  EpochHistoryQuery,
  VaultInitializedEvent,
  DepositedEvent,
  WithdrawalInitiatedEvent,
  WithdrawalCompletedEvent,
  WithdrawalCancelledEvent,
  RewardsClaimedEvent,
  RewardsFundedEvent,
  EpochAdvancedEvent,
  VaultConfigUpdatedEvent,
} from "./types";
