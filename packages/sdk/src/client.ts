import { Program, AnchorProvider, BN, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { IDL, type EurcVault } from "./idl";
import { PROGRAM_ID, EURC_MINT_MAINNET } from "./constants";
import {
  findVaultConfigPda,
  findUserStakePda,
  findEpochSnapshotPda,
  findVaultAuthorityPda,
  findPbEurcMintPda,
  findPbMintAuthorityPda,
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
import { sharesToEurc } from "./utils";

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
 * pbEURC yield-bearing receipt token model:
 * - Deposit EURC → receive pbEURC shares at current exchange rate
 * - Exchange rate grows as rewards are funded → implicit yield
 * - Withdraw by burning pbEURC → receive more EURC than deposited
 *
 * Wraps all 12 instructions and provides query helpers for reading on-chain
 * state. Returns `Transaction` objects so the caller controls signing/sending.
 */
export class EurcVaultClient {
  readonly program: Program<EurcVault>;
  readonly programId: PublicKey;
  private mintCache = new Map<string, PublicKey>();

  constructor(
    public readonly connection: Connection,
    public readonly wallet: Wallet,
    programId: PublicKey = PROGRAM_ID,
  ) {
    this.programId = programId;

    // Build an IDL with the correct program address if overridden
    const idl = programId.equals(PROGRAM_ID)
      ? IDL
      : { ...IDL, address: programId.toBase58() };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    this.program = new Program<EurcVault>(idl as EurcVault, provider);
  }

  // =========================================================================
  // Instruction builders
  // =========================================================================

  /**
   * Initialize a new EURC vault with pbEURC receipt token mint.
   *
   * The connected wallet becomes the vault authority.
   * NOTE: The vault token account (ATA for vault_authority + eurc_mint) must be
   * created client-side before calling this instruction.
   */
  async initializeVault(params: InitializeVaultParams) {
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
    const { publicKey: pbEurcMint } = findPbEurcMintPda(vaultConfig, this.programId);
    const { publicKey: pbMintAuthority } = findPbMintAuthorityPda(vaultConfig, this.programId);

    return this.program.methods
      .initializeVault(
        vaultIdBN,
        toBN(maxCapacity),
        toBN(epochDuration),
        toBN(withdrawalCooldown),
      )
      .accountsPartial({
        authority: this.wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        eurcMint,
        vaultTokenAccount,
        pbEurcMint,
        pbMintAuthority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Deposit EURC into the vault. Mints pbEURC shares at the current exchange rate.
   *
   * NOTE: The user's pbEURC token account (ATA) must be created client-side
   * before calling this instruction.
   */
  async deposit(vaultId: number | BN, params: DepositParams) {
    const accounts = await this.deriveUserAccounts(vaultId);

    return this.program.methods
      .deposit(toBN(params.amount))
      .accountsPartial({
        user: this.wallet.publicKey,
        vaultConfig: accounts.vaultConfig,
        userStake: accounts.userStake,
        vaultAuthority: accounts.vaultAuthority,
        vaultTokenAccount: accounts.vaultTokenAccount,
        userTokenAccount: accounts.userTokenAccount,
        pbEurcMint: accounts.pbEurcMint,
        pbMintAuthority: accounts.pbMintAuthority,
        userPbTokenAccount: accounts.userPbTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  }

  /**
   * Initiate a withdrawal — burns pbEURC shares and locks EURC value
   * until cooldown elapses. Amount is in EURC base units.
   */
  async initiateWithdrawal(
    vaultId: number | BN,
    params: InitiateWithdrawalParams,
  ) {
    const accounts = await this.deriveUserAccounts(vaultId);

    return this.program.methods
      .initiateWithdrawal(toBN(params.amount))
      .accountsPartial({
        user: this.wallet.publicKey,
        vaultConfig: accounts.vaultConfig,
        userStake: accounts.userStake,
        pbEurcMint: accounts.pbEurcMint,
        userPbTokenAccount: accounts.userPbTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Complete a pending withdrawal after the cooldown has elapsed.
   * Transfers locked EURC to the user.
   */
  async completeWithdrawal(vaultId: number | BN) {
    const accounts = await this.deriveUserAccounts(vaultId);

    return this.program.methods
      .completeWithdrawal()
      .accountsPartial({
        user: this.wallet.publicKey,
        vaultConfig: accounts.vaultConfig,
        userStake: accounts.userStake,
        vaultAuthority: accounts.vaultAuthority,
        vaultTokenAccount: accounts.vaultTokenAccount,
        userTokenAccount: accounts.userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Cancel a pending withdrawal — re-mints pbEURC at the CURRENT exchange rate.
   * User may receive fewer shares if the rate grew during cooldown.
   */
  async cancelWithdrawal(vaultId: number | BN) {
    const accounts = await this.deriveUserAccounts(vaultId);

    return this.program.methods
      .cancelWithdrawal()
      .accountsPartial({
        user: this.wallet.publicKey,
        vaultConfig: accounts.vaultConfig,
        userStake: accounts.userStake,
        pbEurcMint: accounts.pbEurcMint,
        pbMintAuthority: accounts.pbMintAuthority,
        userPbTokenAccount: accounts.userPbTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Admin: Fund the rewards pool. Transfers EURC to vault, which increases the
   * exchange rate (more EURC backing the same pbEURC supply).
   */
  async fundRewards(vaultId: number | BN, params: FundRewardsParams) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey: vaultAuthority } = findVaultAuthorityPda(vaultConfig, this.programId);
    const eurcMint = await this.getVaultEurcMintCached(vaultConfig);
    const vaultTokenAccount = getAssociatedTokenAddressSync(eurcMint, vaultAuthority, true);
    const funderTokenAccount = getAssociatedTokenAddressSync(eurcMint, this.wallet.publicKey);

    return this.program.methods
      .fundRewards(toBN(params.amount))
      .accountsPartial({
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
  async advanceEpoch(vaultId: number | BN) {
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
      .accountsPartial({
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
  ) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .updateVaultConfig(
        params.newMaxCapacity != null ? toBN(params.newMaxCapacity) : null,
        params.newEpochDuration != null ? toBN(params.newEpochDuration) : null,
        params.newWithdrawalCooldown != null ? toBN(params.newWithdrawalCooldown) : null,
      )
      .accountsPartial({
        authority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Admin: Toggle the vault paused state.
   */
  async togglePause(vaultId: number | BN) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .togglePause()
      .accountsPartial({
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
  ) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .initiateAuthorityTransfer(params.newAuthority)
      .accountsPartial({
        authority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Accept an authority transfer (called by the new authority).
   */
  async acceptAuthorityTransfer(vaultId: number | BN) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);

    return this.program.methods
      .acceptAuthorityTransfer()
      .accountsPartial({
        newAuthority: this.wallet.publicKey,
        vaultConfig,
      })
      .transaction();
  }

  /**
   * Emergency withdraw — always available, bypasses cooldown and pause.
   * Burns all user pbEURC shares, returns EURC value + any pending withdrawal EURC.
   */
  async emergencyWithdraw(vaultId: number | BN) {
    const accounts = await this.deriveUserAccounts(vaultId);

    return this.program.methods
      .emergencyWithdraw()
      .accountsPartial({
        user: this.wallet.publicKey,
        vaultConfig: accounts.vaultConfig,
        userStake: accounts.userStake,
        vaultAuthority: accounts.vaultAuthority,
        vaultTokenAccount: accounts.vaultTokenAccount,
        userTokenAccount: accounts.userTokenAccount,
        pbEurcMint: accounts.pbEurcMint,
        userPbTokenAccount: accounts.userPbTokenAccount,
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
    const account = await (this.program.account as any).vaultConfig.fetch(publicKey);
    return account as VaultConfig;
  }

  /**
   * Fetch and decode a VaultConfig account, returning null if it doesn't exist.
   */
  async getVaultConfigOrNull(vaultId: number | BN): Promise<VaultConfig | null> {
    const { publicKey } = findVaultConfigPda(toBN(vaultId), this.programId);
    const account = await (this.program.account as any).vaultConfig.fetchNullable(publicKey);
    return account as VaultConfig | null;
  }

  /**
   * Fetch and decode a UserStake account.
   */
  async getUserStake(vaultId: number | BN, user?: PublicKey): Promise<UserStake> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const userKey = user ?? this.wallet.publicKey;
    const { publicKey } = findUserStakePda(vaultConfig, userKey, this.programId);
    const account = await (this.program.account as any).userStake.fetch(publicKey);
    return account as UserStake;
  }

  /**
   * Fetch and decode a UserStake account, returning null if it doesn't exist.
   */
  async getUserStakeOrNull(vaultId: number | BN, user?: PublicKey): Promise<UserStake | null> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const userKey = user ?? this.wallet.publicKey;
    const { publicKey } = findUserStakePda(vaultConfig, userKey, this.programId);
    const account = await (this.program.account as any).userStake.fetchNullable(publicKey);
    return account as UserStake | null;
  }

  /**
   * Fetch and decode a single EpochSnapshot account.
   */
  async getEpochSnapshot(vaultId: number | BN, epochNumber: number | BN): Promise<EpochSnapshot> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey } = findEpochSnapshotPda(vaultConfig, toBN(epochNumber), this.programId);
    const account = await (this.program.account as any).epochSnapshot.fetch(publicKey);
    return account as EpochSnapshot;
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
    const account = await (this.program.account as any).epochSnapshot.fetchNullable(publicKey);
    return account as EpochSnapshot | null;
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
          snapshots.push(decoded as EpochSnapshot);
        } catch {
          // Skip accounts that fail to decode
        }
      }
    }

    return snapshots;
  }

  /**
   * Get the current exchange rate from a vault (as a bigint, scaled by PRECISION).
   */
  async getExchangeRate(vaultId: number | BN): Promise<bigint> {
    const vault = await this.getVaultConfig(vaultId);
    return BigInt(vault.exchangeRate.toString());
  }

  /**
   * Get a user's pbEURC balance for a specific vault.
   * Returns the raw SPL token balance (bigint, 6 decimals).
   */
  async getUserPbEurcBalance(vaultId: number | BN, user?: PublicKey): Promise<bigint> {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey: pbEurcMint } = findPbEurcMintPda(vaultConfig, this.programId);
    const userKey = user ?? this.wallet.publicKey;
    const userPbTokenAccount = getAssociatedTokenAddressSync(pbEurcMint, userKey);

    try {
      const account = await this.connection.getTokenAccountBalance(userPbTokenAccount);
      return BigInt(account.value.amount);
    } catch {
      return 0n;
    }
  }

  /**
   * Get the current EURC value of a user's pbEURC position in a vault.
   * Returns the EURC value in base units (bigint, 6 decimals).
   */
  async getPositionValue(vaultId: number | BN, user?: PublicKey): Promise<bigint> {
    const [balance, exchangeRate] = await Promise.all([
      this.getUserPbEurcBalance(vaultId, user),
      this.getExchangeRate(vaultId),
    ]);

    if (balance === 0n) return 0n;
    return sharesToEurc(balance, exchangeRate);
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

  /** Get the pbEURC mint PDA address for a given vault. */
  getPbEurcMintAddress(vaultId: number | BN): PublicKey {
    const vaultConfig = this.getVaultConfigAddress(vaultId);
    return findPbEurcMintPda(vaultConfig, this.programId).publicKey;
  }

  /** Get the pbEURC mint authority PDA address for a given vault. */
  getPbMintAuthorityAddress(vaultId: number | BN): PublicKey {
    const vaultConfig = this.getVaultConfigAddress(vaultId);
    return findPbMintAuthorityPda(vaultConfig, this.programId).publicKey;
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
   * Includes pbEURC accounts for the receipt token model.
   */
  private async deriveUserAccounts(vaultId: number | BN) {
    const { publicKey: vaultConfig } = findVaultConfigPda(toBN(vaultId), this.programId);
    const { publicKey: vaultAuthority } = findVaultAuthorityPda(vaultConfig, this.programId);
    const { publicKey: userStake } = findUserStakePda(
      vaultConfig,
      this.wallet.publicKey,
      this.programId,
    );
    const { publicKey: pbEurcMint } = findPbEurcMintPda(vaultConfig, this.programId);
    const { publicKey: pbMintAuthority } = findPbMintAuthorityPda(vaultConfig, this.programId);

    const eurcMint = await this.getVaultEurcMintCached(vaultConfig);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      eurcMint,
      vaultAuthority,
      true,
    );
    const userTokenAccount = getAssociatedTokenAddressSync(
      eurcMint,
      this.wallet.publicKey,
    );
    const userPbTokenAccount = getAssociatedTokenAddressSync(
      pbEurcMint,
      this.wallet.publicKey,
    );

    return {
      vaultConfig,
      vaultAuthority,
      vaultTokenAccount,
      userStake,
      userTokenAccount,
      pbEurcMint,
      pbMintAuthority,
      userPbTokenAccount,
    };
  }

  /**
   * Fetch the EURC mint from an on-chain VaultConfig account.
   * Falls back to EURC_MINT_MAINNET if the fetch fails.
   */
  private async getVaultEurcMint(vaultConfig: PublicKey): Promise<PublicKey> {
    try {
      const account = await (this.program.account as any).vaultConfig.fetch(vaultConfig);
      return (account as VaultConfig).eurcMint;
    } catch {
      return EURC_MINT_MAINNET;
    }
  }

  /**
   * Cached version of getVaultEurcMint — avoids repeated RPC calls
   * for the same vaultConfig within a client instance.
   */
  private async getVaultEurcMintCached(vaultConfig: PublicKey): Promise<PublicKey> {
    const key = vaultConfig.toBase58();
    const cached = this.mintCache.get(key);
    if (cached) return cached;
    const mint = await this.getVaultEurcMint(vaultConfig);
    this.mintCache.set(key, mint);
    return mint;
  }
}
