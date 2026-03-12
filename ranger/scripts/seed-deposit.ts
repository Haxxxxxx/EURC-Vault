/**
 * seed-deposit.ts — Deposit initial EURC into the vault for testing.
 *
 * Deposits a small amount to verify the full deposit flow works:
 * wallet EURC → vault → LP tokens minted → strategy deployed
 *
 * Usage: SEED_AMOUNT_EURC=100 npm run seed-deposit
 */
import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync } from 'fs';
import BN from 'bn.js';
import { VoltrClient } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  VAULT_ADMIN_KEYPAIR_PATH,
  ACTIVE_MINT,
  EURC_DECIMALS,
  SOLANA_CLUSTER,
} from '../bot/config.js';

function loadKeypair(path: string): Keypair {
  if (!path) throw new Error('Admin keypair path not set');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

/** Derive ATA address using known seeds (avoids broken spl-token re-exports) */
function findAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/** Build create-ATA instruction manually using known account layout */
function buildCreateAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer,                    isSigner: true,  isWritable: true  },
      { pubkey: ata,                      isSigner: false, isWritable: true  },
      { pubkey: owner,                    isSigner: false, isWritable: false },
      { pubkey: mint,                     isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0), // 0 = CreateIdempotent not required, use CreateOrInit (empty = create)
  });
}

async function main(): Promise<void> {
  const seedAmountEurc  = parseFloat(process.env.SEED_AMOUNT_EURC ?? '10');
  const seedAmountAtoms = Math.floor(seedAmountEurc * 10 ** EURC_DECIMALS);

  console.log('═══════════════════════════════════════════════');
  console.log('  EURC Yield Optimizer — Seed Deposit');
  console.log(`  Cluster: ${SOLANA_CLUSTER}`);
  console.log(`  Amount: ${seedAmountEurc} EURC`);
  console.log('═══════════════════════════════════════════════\n');

  if (!VAULT_ADDRESS) {
    throw new Error('VAULT_ADDRESS not set — run create-vault.ts first');
  }

  const connection  = new Connection(SOLANA_RPC_URL, 'confirmed');
  const admin       = loadKeypair(VAULT_ADMIN_KEYPAIR_PATH);
  const mintPubkey  = new PublicKey(ACTIVE_MINT);
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const client      = new VoltrClient(connection, admin);

  console.log(`Depositor: ${admin.publicKey.toBase58()}`);
  console.log(`Vault:     ${VAULT_ADDRESS}`);
  console.log(`Mint:      ${ACTIVE_MINT}`);
  console.log(`Amount:    ${seedAmountEurc} EURC (${seedAmountAtoms} atoms)\n`);

  // Check SOL balance for gas
  const solBalance = await connection.getBalance(admin.publicKey);
  console.log(`SOL balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
  if (solBalance < 0.01 * 1e9) {
    throw new Error('Low SOL balance — need at least 0.01 SOL for transaction fees');
  }

  // Check EURC token account balance
  const userEurcAta    = findAssociatedTokenAddress(mintPubkey, admin.publicKey);
  const eurcAtaInfo    = await connection.getTokenAccountBalance(userEurcAta);
  const eurcBalanceNum = parseFloat(eurcAtaInfo.value.uiAmountString ?? '0');
  console.log(`EURC balance: ${eurcBalanceNum.toFixed(6)} EURC`);
  if (eurcBalanceNum < seedAmountEurc) {
    throw new Error(
      `Insufficient EURC: have ${eurcBalanceNum.toFixed(6)}, need ${seedAmountEurc}`,
    );
  }

  // Ensure vault LP mint ATA exists for user (create idempotently)
  const { vaultLpMint } = client.findVaultAddresses(vaultPubkey);
  const userLpAta       = findAssociatedTokenAddress(vaultLpMint, admin.publicKey);

  const lpAtaInfo = await connection.getAccountInfo(userLpAta);
  if (!lpAtaInfo) {
    console.log('Creating LP token ATA for depositor...');
    const createAtaIx = buildCreateAtaInstruction(admin.publicKey, userLpAta, admin.publicKey, vaultLpMint);
    const setupTx     = new Transaction().add(createAtaIx);
    const setupSig    = await sendAndConfirmTransaction(connection, setupTx, [admin], {
      commitment: 'confirmed',
    });
    console.log(`LP ATA created — TX: ${setupSig}`);
  }

  // Preview LP tokens to be received
  const expectedLp = await client.calculateLpTokensForDeposit(
    new BN(seedAmountAtoms),
    vaultPubkey,
  );
  console.log(`\nExpected LP tokens: ${expectedLp.toString()}`);

  // Execute deposit
  console.log(`\nDepositing ${seedAmountEurc} EURC...`);
  const ix = await client.createDepositVaultIx(
    new BN(seedAmountAtoms),
    {
      userAuthority:     admin.publicKey,
      vault:             vaultPubkey,
      vaultAssetMint:    mintPubkey,
      assetTokenProgram: TOKEN_PROGRAM_ID,
    },
  );

  const tx  = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: 'confirmed',
  });

  console.log(`✅ Deposited ${seedAmountEurc} EURC`);
  console.log(`   TX: ${sig}`);

  // Verify vault state after deposit: use TVL from position values
  const positionData = await client.getPositionAndTotalValuesForVault(vaultPubkey);
  console.log(`\nVault state after deposit:`);
  console.log(`  Total value: ${positionData.totalValue?.toString() ?? 'n/a'} atoms`);
}

main().catch((err) => {
  console.error('seed-deposit failed:', err);
  process.exit(1);
});
