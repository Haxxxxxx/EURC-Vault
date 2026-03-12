import { Program, AnchorProvider, BN, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  type TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { IDL, type EurcVault } from "./idl";
import { PROGRAM_ID, EURC_MINT_MAINNET } from "./constants";
import {
  findVaultConfigPda,
  findUserStakePda,
  findEpochSnapshotPda,
  findVaultAuthorityPda,
} from "./pda";
import type {
  VaultConfig,
  UserStake,
  EpochSnapshot,
  InitializeVaultParams,
  DepositParams,
  InitiateWithdrawalParams,
  FundRewardsParams,
  UpdateVaultConfigParams,
  InitiateAuthorityTransferParams,
  EpochHistoryQuery,
} from "./types";

// ---------------------------------------------------------------------------
// Helper: convert number | BN to BN
// ---------------------------------------------------------------------------

function toBN(value: number | BN): BN {
  return BN.isBN(value) ? value : new BN(value);
}

// ---------------------------------------------------------------------------
// EurcVaultClient
// ---------------------------------------------------------------------------

/**
 * TypeScript client for the EURC Vault Anchor program.
 *
 * Wraps all 13 instructions and provides query helpers for reading on-chain
 * state. Returns `Transaction` objects so the caller controls signing/sending.
 *
 * @example
 * ```ts
 * const client = new EurcVaultClient(connection, wallet);
 * const tx = await client.deposit(vaultId, { amount: 100_000_000 });
 * const sig = await wallet.sendTransaction(tx, connection);
 * ```
 */
export class EurcVaultClient {
  readonly program: Program<EurcVault>;
  readonly programId: PublicKey;

  constructor(
    public readonly connection: Connection,
    public readonly wallet: Wallet,
    programId: PublicKey = PROGRAM_ID,
  ) {
    this.programId = programId;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program<EurcVault>(IDL, programId, provider);
  }

  // =========================================================================
  // Instruction builders
  // =========================================================================

  /**
   * Initialize a new EURC staking vault.
   *
   * The connected wallet becomes the vault authority.
   */
  async initializeVault(params: InitializeVaultParams): Promise<Transaction> {
    const {
      vaultId,
      maxCapacity,
      epochDuration,
      withdrawalCooldown,
      eurcMint = EURC_MINT_MAINNET,
    } = params;

    const vaultIdBN = toBN(vaultId);
    const { publicKey: vaultConfig } = findVaultConfigPda(vaultIdBN, this.programId);
    const { publicKey: vaultAuthority } = findVaultAuthorityPda(vaultConfig, this.programId);
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      eurcMint,
      vaultAuthority,
      true, // allowOwnerOffCurve (PDA)
    );

    const ix = await this.program.methods
      .initializeVault(
        vaultIdBN,
        toBN(maxCapacity),
        toBN(epochDuration),
        toBN(withdrawalCooldown),
      )
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        eurcMint,
        vaultTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    return ix;
  }

  /**
   * Deposit EURC into the vault. Auto-claims pending rewards.
   */
  async deposit(vaultId: number | BN, params: DepositParams): Promise<Transaction> {
    const { vaultConfig, vaultAuthority, vaultTokenAccount, userStake, userTokenAccount } =
      this.deriveUserAccounts(vaultId);

    return this.program.methods
      .deposit(toBN(params.amount))
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
        vaultAuthority,
        vaultTokenAccount,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  }

  /**
   * Initiate a withdrawal (starts cooldown period).
   */
  async initiateWithdrawal(
    vaultId: number | BN,
    params: InitiateWithdrawalParams,
  ): Promise<Transaction> {
    const { vaultConfig, userStake } = this.deriveUserAccounts(vaultId);

    return this.program.methods
      .initiateWithdrawal(toBN(params.amount))
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
      })
      .transaction();
  }

  /**
   * Complete a pending withdrawal after the cooldown has elapsed.
   */
  async completeWithdrawal(vaultId: number | BN): Promise<Transaction> {
    const { vaultConfig, vaultAuthority, vaultTokenAccount, userStake, userTokenAccount } =
      this.deriveUserAccounts(vaultId);

    return this.program.methods
      .completeWithdrawal()
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
        vaultAuthority,
        vaultTokenAccount,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Cancel a pending withdrawal (re-stakes the amount).
   */
  async cancelWithdrawal(vaultId: number | BN): Promise<Transaction> {
    const { vaultConfig, userStake } = this.deriveUserAccounts(vaultId);

    return this.program.methods
      .cancelWithdrawal()
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
      })
      .transaction();
  }

  /**
   * Claim accumulated rewards without changing the deposit.
   */
  async claimRewards(vaultId: number | BN): Promise<Transaction> {
    const { vaultConfig, vaultAuthority, vaultTokenAccount, userStake, userTokenAccount } =
      this.deriveUserAccounts(vaultId);

    return this.program.methods
      .claimRewards()
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
        vaultAuthority,
        vaultTokenAccount,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Admin: Fund the rewards pool (increases accumulated_reward_per_share).
   */
  async fundRewards(vaultId: number | BN, params: FundRewardsParams): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey: vaultAuthority } = findVaultAuthorityPda(vaultConfig, this.programId);
    const eurcMint = await this.getVaultEurcMint(vaultConfig);
    const vaultTokenAccount = getAssociatedTokenAddressSync(eurcMint, vaultAuthority, true);
    const funderTokenAccount = getAssociatedTokenAddressSync(eurcMint, this.wallet.publicKey);

    return this.program.methods
      .fundRewards(toBN(params.amount))
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        vaultTokenAccount,
        funderTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Admin: Advance to the next epoch (creates an on-chain snapshot).
   */
  async advanceEpoch(vaultId: number | BN): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    // We need the current epoch number to derive the snapshot PDA
    const vault = await this.getVaultConfig(vaultId);
    const currentEpoch = vault.currentEpoch;
    const { publicKey: epochSnapshot } = findEpochSnapshotPda(
      vaultConfig,
      currentEpoch,
      this.programId,
    );

    return this.program.methods
      .advanceEpoch()
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
        epochSnapshot,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  }

  /**
   * Admin: Update vault configuration parameters.
   */
  async updateVaultConfig(
    vaultId: number | BN,
    params: UpdateVaultConfigParams,
  ): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .updateVaultConfig(
        params.newMaxCapacity != null ? toBN(params.newMaxCapacity) : null,
        params.newEpochDuration != null ? toBN(params.newEpochDuration) : null,
        params.newWithdrawalCooldown != null ? toBN(params.newWithdrawalCooldown) : null,
      )
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Admin: Toggle the vault paused state.
   */
  async togglePause(vaultId: number | BN): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .togglePause()
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Admin: Initiate a 2-step authority transfer.
   */
  async initiateAuthorityTransfer(
    vaultId: number | BN,
    params: InitiateAuthorityTransferParams,
  ): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .initiateAuthorityTransfer(params.newAuthority)
      .accounts({
        authority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Accept an authority transfer (called by the new authority).
   */
  async acceptAuthorityTransfer(vaultId: number | BN): Promise<Transaction> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .acceptAuthorityTransfer()
      .accounts({
        newAuthority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Emergency withdraw -- always available, bypasses cooldown and pause.
   * Withdraws the user's entire deposit plus pending rewards.
   */
  async emergencyWithdraw(vaultId: number | BN): Promise<Transaction> {
    const { vaultConfig, vaultAuthority, vaultTokenAccount, userStake, userTokenAccount } =
      this.deriveUserAccounts(vaultId);

    return this.program.methods
      .emergencyWithdraw()
      .accounts({
        user: this.wallet.publicKey,
        vaultConfig,
        userStake,
        vaultAuthority,
        vaultTokenAccount,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  // =========================================================================
  // Query methods
  // =========================================================================

  /**
   * Fetch and decode a VaultConfig account.
   */
  async getVaultConfig(vaultId: number | BN): Promise<VaultConfig> {
    const { publicKey } = findVaultConfigPda(toBN(vaultId), this.programId);
    const account = await this.program.account.vaultConfig.fetch(publicKey);
    return account as unknown as VaultConfig;
  }

  /**
   * Fetch and decode a VaultConfig account, returning null if it doesn't exist.
   */
  async getVaultConfigOrNull(vaultId: number | BN): Promise<VaultConfig | null> {
    const { publicKey } = findVaultConfigPda(toBN(vaultId), this.programId);
    const account = await this.program.account.vaultConfig.fetchNullable(publicKey);
    return account as unknown as VaultConfig | null;
  }

  /**
   * Fetch and decode a UserStake account.
   */
  async getUserStake(vaultId: number | BN, user?: PublicKey): Promise<UserStake> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const userKey = user ?? this.wallet.publicKey;
    const { publicKey } = findUserStakePda(vaultConfig, userKey, this.programId);
    const account = await this.program.account.userStake.fetch(publicKey);
    return account as unknown as UserStake;
  }

  /**
   * Fetch and decode a UserStake account, returning null if it doesn't exist.
   */
  async getUserStakeOrNull(vaultId: number | BN, user?: PublicKey): Promise<UserStake | null> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const userKey = user ?? this.wallet.publicKey;
    const { publicKey } = findUserStakePda(vaultConfig, userKey, this.programId);
    const account = await this.program.account.userStake.fetchNullable(publicKey);
    return account as unknown as UserStake | null;
  }

  /**
   * Fetch and decode a single EpochSnapshot account.
   */
  async getEpochSnapshot(vaultId: number | BN, epochNumber: number | BN): Promise<EpochSnapshot> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey } = findEpochSnapshotPda(vaultConfig, toBN(epochNumber), this.programId);
    const account = await this.program.account.epochSnapshot.fetch(publicKey);
    return account as unknown as EpochSnapshot;
  }

  /**
   * Fetch and decode a single EpochSnapshot, returning null if it doesn't exist.
   */
  async getEpochSnapshotOrNull(
    vaultId: number | BN,
    epochNumber: number | BN,
  ): Promise<EpochSnapshot | null> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey } = findEpochSnapshotPda(vaultConfig, toBN(epochNumber), this.programId);
    const account = await this.program.account.epochSnapshot.fetchNullable(publicKey);
    return account as unknown as EpochSnapshot | null;
  }

  /**
   * Fetch a range of epoch snapshots for a vault.
   *
   * Fetches from `fromEpoch` to `toEpoch` (inclusive) using `getMultipleAccounts`
   * for efficient batching. Skips epochs that don't exist on-chain.
   */
  async getEpochHistory(
    vaultId: number | BN,
    query?: EpochHistoryQuery,
  ): Promise<EpochSnapshot[]> {
    const vault = await this.getVaultConfig(vaultId);
    const currentEpoch = vault.currentEpoch.toNumber();

    const fromEpoch = query?.fromEpoch ?? 1;
    const toEpoch = query?.toEpoch ?? Math.max(currentEpoch - 1, 0);

    if (fromEpoch > toEpoch) return [];

    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    // Derive all PDA addresses
    const addresses: PublicKey[] = [];
    for (let i = fromEpoch; i <= toEpoch; i++) {
      const { publicKey } = findEpochSnapshotPda(vaultConfig, i, this.programId);
      addresses.push(publicKey);
    }

    // Batch fetch (getMultipleAccountsInfo chunks internally at 100)
    const snapshots: EpochSnapshot[] = [];
    const chunkSize = 100;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      const accountInfos = await this.connection.getMultipleAccountsInfo(chunk);

      for (const info of accountInfos) {
        if (info === null) continue;
        try {
          const decoded = this.program.coder.accounts.decode("EpochSnapshot", info.data);
          snapshots.push(decoded as unknown as EpochSnapshot);
        } catch {
          // Skip accounts that fail to decode
        }
      }
    }

    return snapshots;
  }

  // =========================================================================
  // PDA address getters (convenience)
  // =========================================================================

  /** Get the VaultConfig PDA address for a given vault ID. */
  getVaultConfigAddress(vaultId: number | BN): PublicKey {
    return findVaultConfigPda(toBN(vaultId), this.programId).publicKey;
  }

  /** Get the UserStake PDA address for a given vault and user. */
  getUserStakeAddress(vaultId: number | BN, user?: PublicKey): PublicKey {
    const vaultConfig = this.getVaultConfigAddress(vaultId);
    return findUserStakePda(vaultConfig, user ?? this.wallet.publicKey, this.programId).publicKey;
  }

  /** Get the VaultAuthority PDA address for a given vault. */
  getVaultAuthorityAddress(vaultId: number | BN): PublicKey {
    const vaultConfig = this.getVaultConfigAddress(vaultId);
    return findVaultAuthorityPda(vaultConfig, this.programId).publicKey;
  }

  /** Get the vault's EURC token account address. */
  async getVaultTokenAccountAddress(vaultId: number | BN): Promise<PublicKey> {
    const vaultConfig = this.getVaultConfigAddress(vaultId);
    const vaultAuthority = findVaultAuthorityPda(vaultConfig, this.programId).publicKey;
    const eurcMint = await this.getVaultEurcMint(vaultConfig);
    return getAssociatedTokenAddressSync(eurcMint, vaultAuthority, true);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Derive all common user-facing account addresses for a vault.
   * Uses the connected wallet's EURC ATA and the vault's EURC mint
   * (fetched lazily or using the mainnet default for the token account derivation).
   */
  private deriveUserAccounts(vaultId: number | BN) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey: vaultAuthority } = findVaultAuthorityPda(vaultConfig, this.programId);
    const { publicKey: userStake } = findUserStakePda(
      vaultConfig,
      this.wallet.publicKey,
      this.programId,
    );

    // NOTE: We use EURC_MINT_MAINNET as the default for ATA derivation.
    // The on-chain program validates the actual mint. If using a different
    // mint (e.g. devnet test mint), callers should use the explicit
    // instruction builder methods instead.
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      EURC_MINT_MAINNET,
      vaultAuthority,
      true,
    );
    const userTokenAccount = getAssociatedTokenAddressSync(
      EURC_MINT_MAINNET,
      this.wallet.publicKey,
    );

    return {
      vaultConfig,
      vaultAuthority,
      vaultTokenAccount,
      userStake,
      userTokenAccount,
    };
  }

  /**
   * Fetch the EURC mint from an on-chain VaultConfig account.
   * Falls back to EURC_MINT_MAINNET if the fetch fails.
   */
  private async getVaultEurcMint(vaultConfig: PublicKey): Promise<PublicKey> {
    try {
      const account = await this.program.account.vaultConfig.fetch(vaultConfig);
      return (account as unknown as VaultConfig).eurcMint;
    } catch {
      return EURC_MINT_MAINNET;
    }
  }
}
