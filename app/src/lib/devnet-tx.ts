'use client';

import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PROGRAM_ID, TEST_EURC_MINT } from './constants';

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const VAULT_SEED = Buffer.from('vault');
const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');
const USER_STAKE_SEED = Buffer.from('user_stake');
const PB_EURC_MINT_SEED = Buffer.from('pbeurc_mint');
const PB_EURC_MINT_AUTH_SEED = Buffer.from('pbeurc_mint_auth');

// ---------------------------------------------------------------------------
// Pre-computed Anchor instruction discriminators
// SHA256("global:<instruction_name>")[0..8]
// ---------------------------------------------------------------------------

const DISC = {
  initialize_vault:    Buffer.from([0x30, 0xbf, 0xa3, 0x2c, 0x47, 0x81, 0x3f, 0xa4]),
  deposit:             Buffer.from([0xf2, 0x23, 0xc6, 0x89, 0x52, 0xe1, 0xf2, 0xb6]),
  fund_rewards:        Buffer.from([0x72, 0x40, 0xa3, 0x70, 0xaf, 0xa7, 0x13, 0x79]),
  initiate_withdrawal: Buffer.from([0x45, 0xd8, 0x83, 0x4a, 0x72, 0x7a, 0x26, 0x70]),
  complete_withdrawal: Buffer.from([0x6b, 0x62, 0x86, 0x83, 0x4a, 0x78, 0xae, 0x79]),
  cancel_withdrawal:   Buffer.from([0xb7, 0x68, 0xb5, 0xfa, 0x1c, 0x80, 0xd2, 0x46]),
  emergency_withdraw:  Buffer.from([0xef, 0x2d, 0xcb, 0x40, 0x96, 0x49, 0xda, 0x5c]),
} as const;

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

export function deriveVaultPdas(vaultId: number) {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(vaultId));

  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, idBuf],
    PROGRAM_ID,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );
  const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
    [vaultAuthority.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), TEST_EURC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pbEurcMint] = PublicKey.findProgramAddressSync(
    [PB_EURC_MINT_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );
  const [pbMintAuthority] = PublicKey.findProgramAddressSync(
    [PB_EURC_MINT_AUTH_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );

  return { vaultConfig, vaultAuthority, vaultTokenAccount, pbEurcMint, pbMintAuthority };
}

export function deriveUserPdas(vaultConfig: PublicKey, user: PublicKey, pbEurcMint?: PublicKey) {
  const [userStake] = PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, vaultConfig.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );
  const [userTokenAccount] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), TEST_EURC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Derive user's pbEURC associated token account if pbEurcMint is provided
  let userPbTokenAccount: PublicKey | undefined;
  if (pbEurcMint) {
    [userPbTokenAccount] = PublicKey.findProgramAddressSync(
      [user.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), pbEurcMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
  }

  return { userStake, userTokenAccount, userPbTokenAccount };
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

export function buildInitializeVaultTx(
  authority: PublicKey,
  vaultId: number,
  maxCapacity: bigint,
  epochDuration: bigint,
  withdrawalCooldown: bigint,
): Transaction {
  const { vaultConfig, vaultAuthority, vaultTokenAccount, pbEurcMint, pbMintAuthority } = deriveVaultPdas(vaultId);

  const data = Buffer.alloc(40);
  DISC.initialize_vault.copy(data, 0);
  data.writeBigUInt64LE(BigInt(vaultId), 8);
  data.writeBigUInt64LE(maxCapacity, 16);
  data.writeBigInt64LE(epochDuration, 24);
  data.writeBigInt64LE(withdrawalCooldown, 32);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: TEST_EURC_MINT, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: pbEurcMint, isSigner: false, isWritable: true },
        { pubkey: pbMintAuthority, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  );
}

export function buildDepositTx(
  user: PublicKey,
  vaultId: number,
  amount: bigint,
): Transaction {
  const { vaultConfig, vaultAuthority, vaultTokenAccount, pbEurcMint, pbMintAuthority } = deriveVaultPdas(vaultId);
  const { userStake, userTokenAccount, userPbTokenAccount } = deriveUserPdas(vaultConfig, user, pbEurcMint);

  const data = Buffer.alloc(16);
  DISC.deposit.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: userStake, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: pbEurcMint, isSigner: false, isWritable: true },
        { pubkey: pbMintAuthority, isSigner: false, isWritable: false },
        { pubkey: userPbTokenAccount!, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  );
}

export function buildFundRewardsTx(
  authority: PublicKey,
  vaultId: number,
  amount: bigint,
): Transaction {
  const { vaultConfig, vaultAuthority, vaultTokenAccount } = deriveVaultPdas(vaultId);
  const { userTokenAccount } = deriveUserPdas(vaultConfig, authority);

  const data = Buffer.alloc(16);
  DISC.fund_rewards.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  );
}

export function buildInitiateWithdrawalTx(
  user: PublicKey,
  vaultId: number,
  amount: bigint,
): Transaction {
  const { vaultConfig, pbEurcMint } = deriveVaultPdas(vaultId);
  const { userStake, userPbTokenAccount } = deriveUserPdas(vaultConfig, user, pbEurcMint);

  const data = Buffer.alloc(16);
  DISC.initiate_withdrawal.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: userStake, isSigner: false, isWritable: true },
        { pubkey: pbEurcMint, isSigner: false, isWritable: true },
        { pubkey: userPbTokenAccount!, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  );
}

export function buildCompleteWithdrawalTx(
  user: PublicKey,
  vaultId: number,
): Transaction {
  const { vaultConfig, vaultAuthority, vaultTokenAccount } = deriveVaultPdas(vaultId);
  const { userStake, userTokenAccount } = deriveUserPdas(vaultConfig, user);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: userStake, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: DISC.complete_withdrawal,
    }),
  );
}

export function buildCancelWithdrawalTx(
  user: PublicKey,
  vaultId: number,
): Transaction {
  const { vaultConfig, pbEurcMint, pbMintAuthority } = deriveVaultPdas(vaultId);
  const { userStake, userPbTokenAccount } = deriveUserPdas(vaultConfig, user, pbEurcMint);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: userStake, isSigner: false, isWritable: true },
        { pubkey: pbEurcMint, isSigner: false, isWritable: true },
        { pubkey: pbMintAuthority, isSigner: false, isWritable: false },
        { pubkey: userPbTokenAccount!, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: DISC.cancel_withdrawal,
    }),
  );
}

export function buildEmergencyWithdrawTx(
  user: PublicKey,
  vaultId: number,
): Transaction {
  const { vaultConfig, vaultAuthority, vaultTokenAccount, pbEurcMint } = deriveVaultPdas(vaultId);
  const { userStake, userTokenAccount, userPbTokenAccount } = deriveUserPdas(vaultConfig, user, pbEurcMint);

  return new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: vaultConfig, isSigner: false, isWritable: true },
        { pubkey: userStake, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: pbEurcMint, isSigner: false, isWritable: true },
        { pubkey: userPbTokenAccount!, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: DISC.emergency_withdraw,
    }),
  );
}
