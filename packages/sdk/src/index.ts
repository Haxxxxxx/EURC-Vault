// ---------------------------------------------------------------------------
// @eurc-vault/sdk — public API (pbEURC yield-bearing receipt token model)
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
  findPbEurcMintPda,
  findPbMintAuthorityPda,
} from "./pda";

// Constants
export {
  PROGRAM_ID,
  VAULT_SEED,
  USER_STAKE_SEED,
  EPOCH_SEED,
  VAULT_AUTHORITY_SEED,
  PB_EURC_MINT_SEED,
  PB_EURC_MINT_AUTH_SEED,
  PRECISION,
  INITIAL_EXCHANGE_RATE,
  EURC_DECIMALS,
  PB_EURC_DECIMALS,
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
  calculateExchangeRate,
  eurcToShares,
  sharesToEurc,
  calculatePositionValue,
  calculateYieldEarned,
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
  RewardsFundedEvent,
  EpochAdvancedEvent,
  VaultConfigUpdatedEvent,
  EmergencyWithdrawalExecutedEvent,
} from "./types";
