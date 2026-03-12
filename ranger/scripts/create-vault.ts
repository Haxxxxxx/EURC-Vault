/**
 * create-vault.ts — Initialize the EURC yield optimizer vault on Ranger Earn.
 *
 * Usage:
 *   npm run create-vault
 *
 * Requires:
 *   VAULT_ADMIN_KEYPAIR_PATH   — path to admin keypair JSON
 *   VAULT_MANAGER_KEYPAIR_PATH — path to manager keypair JSON
 *   SOLANA_RPC_URL             — devnet or mainnet RPC
 *
 * After running, set VAULT_ADDRESS in .env with the output pubkey.
 */
import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import BN from 'bn.js';
import { VoltrClient } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADMIN_KEYPAIR_PATH,
  VAULT_MANAGER_KEYPAIR_PATH,
  ACTIVE_MINT,
  VAULT_MGMT_FEE_BPS,
  VAULT_PERF_FEE_BPS,
  VAULT_MAX_CAPACITY,
  VAULT_WITHDRAWAL_WAIT_PERIOD_SECONDS,
  SOLANA_CLUSTER,
} from '../bot/config.js';

function loadKeypair(path: string, label: string): Keypair {
  if (!path) throw new Error(`${label} keypair path not set in .env`);
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  EURC Yield Optimizer — Create Vault');
  console.log(`  Cluster: ${SOLANA_CLUSTER}`);
  console.log(`  RPC: ${SOLANA_RPC_URL}`);
  console.log('═══════════════════════════════════════════════\n');

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const admin   = loadKeypair(VAULT_ADMIN_KEYPAIR_PATH,   'VAULT_ADMIN_KEYPAIR_PATH');
  const manager = loadKeypair(VAULT_MANAGER_KEYPAIR_PATH, 'VAULT_MANAGER_KEYPAIR_PATH');

  console.log(`Admin:   ${admin.publicKey.toBase58()}`);
  console.log(`Manager: ${manager.publicKey.toBase58()}`);
  console.log(`EURC Mint: ${ACTIVE_MINT}\n`);

  // Check balances
  const adminBalance   = await connection.getBalance(admin.publicKey);
  const managerBalance = await connection.getBalance(manager.publicKey);
  console.log(`Admin balance:   ${(adminBalance   / 1e9).toFixed(4)} SOL`);
  console.log(`Manager balance: ${(managerBalance / 1e9).toFixed(4)} SOL`);

  if (adminBalance < 0.1 * 1e9) {
    throw new Error('Admin wallet needs at least 0.1 SOL for vault initialization');
  }

  const mintPubkey    = new PublicKey(ACTIVE_MINT);
  const vaultKeypair  = Keypair.generate();
  const client        = new VoltrClient(connection, admin);

  console.log(`\nVault Keypair: ${vaultKeypair.publicKey.toBase58()}`);

  const vaultParams = {
    config: {
      maxCap:                          new BN(VAULT_MAX_CAPACITY.toString()),
      startAtTs:                       new BN(Math.floor(Date.now() / 1000)),
      lockedProfitDegradationDuration: new BN(VAULT_WITHDRAWAL_WAIT_PERIOD_SECONDS),
      managerManagementFee:            VAULT_MGMT_FEE_BPS,
      managerPerformanceFee:           VAULT_PERF_FEE_BPS,
      adminManagementFee:              0,
      adminPerformanceFee:             0,
    },
    name:        'EURC Yield Optimizer',
    description: 'Cross-protocol EURC lending optimizer',
  };

  console.log('\nCreating vault with config:');
  console.log(`  Max Cap: ${(VAULT_MAX_CAPACITY / 1_000_000).toLocaleString()} EURC`);
  console.log(`  Mgmt Fee: ${VAULT_MGMT_FEE_BPS} bps (${VAULT_MGMT_FEE_BPS / 100}%)`);
  console.log(`  Perf Fee: ${VAULT_PERF_FEE_BPS} bps (${VAULT_PERF_FEE_BPS / 100}%)`);
  console.log(`  Locked Profit Duration: ${VAULT_WITHDRAWAL_WAIT_PERIOD_SECONDS / 3600}h\n`);

  const ix = await client.createInitializeVaultIx(
    vaultParams,
    {
      vault:          vaultKeypair,
      vaultAssetMint: mintPubkey,
      admin:          admin.publicKey,
      manager:        manager.publicKey,
      payer:          admin.publicKey,
    },
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin, vaultKeypair], {
    commitment: 'confirmed',
  });

  console.log(`✅ Vault created!`);
  console.log(`   Vault address: ${vaultKeypair.publicKey.toBase58()}`);
  console.log(`   TX signature:  ${sig}`);
  console.log(`\nNext step — add to .env:`);
  console.log(`  VAULT_ADDRESS=${vaultKeypair.publicKey.toBase58()}`);
  console.log(`\nThen run: npm run add-adaptors`);
}

main().catch((err) => {
  console.error('create-vault failed:', err);
  process.exit(1);
});
