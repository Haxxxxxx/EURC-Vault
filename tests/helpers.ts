import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { EurcVault } from "../target/types/eurc_vault";

// ── Seeds ──────────────────────────────────────────────────────────────
export const VAULT_SEED = Buffer.from("vault");
export const USER_STAKE_SEED = Buffer.from("user_stake");
export const EPOCH_SEED = Buffer.from("epoch");
export const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");

// ── Constants ──────────────────────────────────────────────────────────
export const EURC_DECIMALS = 6;
export const ONE_EURC = 1_000_000; // 10^6
export const PRECISION = BigInt("1000000000000"); // 10^12
export const DEFAULT_EPOCH_DURATION = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_COOLDOWN = 24 * 60 * 60; // 1 day
export const DEFAULT_CAPACITY = 10_000_000 * ONE_EURC; // 10M EURC

// ── PDA Derivation ─────────────────────────────────────────────────────
export function findVaultConfigPda(
  vaultId: number,
  programId: PublicKey
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(vaultId));
  return PublicKey.findProgramAddressSync([VAULT_SEED, buf], programId);
}

export function findVaultAuthorityPda(
  vaultConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vaultConfig.toBuffer()],
    programId
  );
}

export function findUserStakePda(
  vaultConfig: PublicKey,
  user: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, vaultConfig.toBuffer(), user.toBuffer()],
    programId
  );
}

export function findEpochSnapshotPda(
  vaultConfig: PublicKey,
  epochNumber: number,
  programId: PublicKey
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(epochNumber));
  return PublicKey.findProgramAddressSync(
    [EPOCH_SEED, vaultConfig.toBuffer(), buf],
    programId
  );
}

// ── Test Setup Helpers ─────────────────────────────────────────────────
export interface TestContext {
  program: Program<EurcVault>;
  provider: anchor.AnchorProvider;
  authority: Keypair;
  eurcMint: PublicKey;
  vaultId: number;
  vaultConfig: PublicKey;
  vaultConfigBump: number;
  vaultAuthority: PublicKey;
  vaultAuthorityBump: number;
  vaultTokenAccount: PublicKey;
}

export async function airdrop(
  provider: anchor.AnchorProvider,
  to: PublicKey,
  amount: number = 10 * LAMPORTS_PER_SOL
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(to, amount);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

export async function createTestMint(
  provider: anchor.AnchorProvider,
  authority: Keypair
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    EURC_DECIMALS
  );
}

export async function createTestTokenAccount(
  provider: anchor.AnchorProvider,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return createAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner
  );
}

export async function mintTestTokens(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  mintAuthority: Keypair,
  destination: PublicKey,
  amount: number
): Promise<void> {
  await mintTo(
    provider.connection,
    mintAuthority,
    mint,
    destination,
    mintAuthority,
    amount
  );
}

export async function setupTestVault(
  program: Program<EurcVault>,
  provider: anchor.AnchorProvider,
  vaultId: number = 1,
  epochDuration: number = DEFAULT_EPOCH_DURATION,
  cooldown: number = DEFAULT_COOLDOWN,
  capacity: number = DEFAULT_CAPACITY
): Promise<TestContext> {
  const authority = Keypair.generate();
  await airdrop(provider, authority.publicKey);

  const eurcMint = await createTestMint(provider, authority);

  const [vaultConfig, vaultConfigBump] = findVaultConfigPda(
    vaultId,
    program.programId
  );
  const [vaultAuthority, vaultAuthorityBump] = findVaultAuthorityPda(
    vaultConfig,
    program.programId
  );
  const vaultTokenAccount = await getAssociatedTokenAddress(
    eurcMint,
    vaultAuthority,
    true
  );

  await program.methods
    .initializeVault(
      new anchor.BN(vaultId),
      new anchor.BN(capacity),
      new anchor.BN(epochDuration),
      new anchor.BN(cooldown)
    )
    .accounts({
      authority: authority.publicKey,
      vaultConfig,
      vaultAuthority,
      eurcMint,
      vaultTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([authority])
    .rpc();

  return {
    program,
    provider,
    authority,
    eurcMint,
    vaultId,
    vaultConfig,
    vaultConfigBump,
    vaultAuthority,
    vaultAuthorityBump,
    vaultTokenAccount,
  };
}

export async function setupUserWithTokens(
  ctx: TestContext,
  amount: number = 1000 * ONE_EURC
): Promise<{ user: Keypair; userTokenAccount: PublicKey }> {
  const user = Keypair.generate();
  await airdrop(ctx.provider, user.publicKey);

  const userTokenAccount = await createTestTokenAccount(
    ctx.provider,
    user,
    ctx.eurcMint,
    user.publicKey
  );
  await mintTestTokens(
    ctx.provider,
    ctx.eurcMint,
    ctx.authority,
    userTokenAccount,
    amount
  );

  return { user, userTokenAccount };
}

export async function deposit(
  ctx: TestContext,
  user: Keypair,
  userTokenAccount: PublicKey,
  amount: number
): Promise<void> {
  const [userStake] = findUserStakePda(
    ctx.vaultConfig,
    user.publicKey,
    ctx.program.programId
  );

  await ctx.program.methods
    .deposit(new anchor.BN(amount))
    .accounts({
      user: user.publicKey,
      vaultConfig: ctx.vaultConfig,
      userStake,
      vaultAuthority: ctx.vaultAuthority,
      vaultTokenAccount: ctx.vaultTokenAccount,
      userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([user])
    .rpc();
}

export async function fundRewards(
  ctx: TestContext,
  amount: number
): Promise<void> {
  const funderTokenAccount = await getAssociatedTokenAddress(
    ctx.eurcMint,
    ctx.authority.publicKey
  );

  // Ensure authority has tokens to fund with
  try {
    await createTestTokenAccount(
      ctx.provider,
      ctx.authority,
      ctx.eurcMint,
      ctx.authority.publicKey
    );
  } catch {
    // Account may already exist
  }
  await mintTestTokens(
    ctx.provider,
    ctx.eurcMint,
    ctx.authority,
    funderTokenAccount,
    amount
  );

  await ctx.program.methods
    .fundRewards(new anchor.BN(amount))
    .accounts({
      authority: ctx.authority.publicKey,
      vaultConfig: ctx.vaultConfig,
      vaultAuthority: ctx.vaultAuthority,
      vaultTokenAccount: ctx.vaultTokenAccount,
      funderTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([ctx.authority])
    .rpc();
}

// ── Invariant Checkers ─────────────────────────────────────────────────
export async function checkVaultInvariant(
  ctx: TestContext
): Promise<void> {
  const vaultData = await ctx.program.account.vaultConfig.fetch(ctx.vaultConfig);
  const tokenBalance = await ctx.provider.connection.getTokenAccountBalance(
    ctx.vaultTokenAccount
  );
  const actualBalance = Number(tokenBalance.value.amount);

  // Invariant 1: token account >= total_deposits
  if (actualBalance < vaultData.totalDeposits.toNumber()) {
    throw new Error(
      `INVARIANT VIOLATED: token balance (${actualBalance}) < total_deposits (${vaultData.totalDeposits.toNumber()})`
    );
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
