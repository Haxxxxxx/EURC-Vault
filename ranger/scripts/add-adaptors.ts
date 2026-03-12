/**
 * add-adaptors.ts — Register Drift, Kamino, and Save adaptors on our vault.
 *
 * Usage:
 *   npm run add-adaptors
 *
 * Requires: VAULT_ADDRESS set in .env after create-vault.ts.
 *
 * Each adaptor is a pre-deployed Ranger Earn program that handles the
 * protocol-specific strategy logic (deposit/withdraw/harvest).
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
import { VoltrClient, LENDING_ADAPTOR_PROGRAM_ID, DRIFT_ADAPTOR_PROGRAM_ID } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  VAULT_ADMIN_KEYPAIR_PATH,
  ADAPTOR_IDS,
  SOLANA_CLUSTER,
} from '../bot/config.js';

interface AdaptorConfig {
  name: string;
  adaptorProgram: PublicKey;
  description: string;
}

const KAMINO_ADAPTOR_PROGRAM_ID = new PublicKey('to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR');

const ADAPTORS_TO_REGISTER: AdaptorConfig[] = [
  {
    name:           'Save/Lending',
    adaptorProgram: LENDING_ADAPTOR_PROGRAM_ID,
    description:    'Save (Solend) EURC lending reserve — 5–7% APY',
  },
  {
    name:           'Drift',
    adaptorProgram: DRIFT_ADAPTOR_PROGRAM_ID,
    description:    'Drift Protocol EURC spot market lending — 8–12% APY',
  },
  {
    name:           'Kamino',
    adaptorProgram: KAMINO_ADAPTOR_PROGRAM_ID,
    description:    'Kamino Finance kLend EURC reserve — 6–8% APY',
  },
];

// Verify adaptor IDs match SDK constants (sanity check)
const _expectedLending = ADAPTOR_IDS.lending;
const _expectedDrift   = ADAPTOR_IDS.drift;
if (LENDING_ADAPTOR_PROGRAM_ID.toBase58() !== _expectedLending) {
  console.warn(`WARNING: SDK LENDING_ADAPTOR_PROGRAM_ID (${LENDING_ADAPTOR_PROGRAM_ID.toBase58()}) !== config (${_expectedLending})`);
}
if (DRIFT_ADAPTOR_PROGRAM_ID.toBase58() !== _expectedDrift) {
  console.warn(`WARNING: SDK DRIFT_ADAPTOR_PROGRAM_ID (${DRIFT_ADAPTOR_PROGRAM_ID.toBase58()}) !== config (${_expectedDrift})`);
}

function loadKeypair(path: string, label: string): Keypair {
  if (!path) throw new Error(`${label} keypair path not set in .env`);
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  EURC Yield Optimizer — Add Adaptors');
  console.log(`  Cluster: ${SOLANA_CLUSTER}`);
  console.log('═══════════════════════════════════════════════\n');

  if (!VAULT_ADDRESS) {
    throw new Error('VAULT_ADDRESS not set in .env — run create-vault.ts first');
  }

  const connection  = new Connection(SOLANA_RPC_URL, 'confirmed');
  const admin       = loadKeypair(VAULT_ADMIN_KEYPAIR_PATH, 'VAULT_ADMIN_KEYPAIR_PATH');
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const client      = new VoltrClient(connection, admin);

  console.log(`Vault:  ${VAULT_ADDRESS}`);
  console.log(`Admin:  ${admin.publicKey.toBase58()}\n`);

  for (const adaptor of ADAPTORS_TO_REGISTER) {
    console.log(`Registering adaptor: ${adaptor.name}`);
    console.log(`  Program ID: ${adaptor.adaptorProgram.toBase58()}`);
    console.log(`  ${adaptor.description}`);

    const ix = await client.createAddAdaptorIx({
      vault:          vaultPubkey,
      payer:          admin.publicKey,
      admin:          admin.publicKey,
      adaptorProgram: adaptor.adaptorProgram,
    });

    const tx  = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
      commitment: 'confirmed',
    });

    console.log(`  ✅ Registered — TX: ${sig}\n`);
  }

  // Verify registrations
  console.log('Verifying adaptor registrations...');
  const receipts = await client.fetchAllAdaptorAddReceiptAccountsOfVault(vaultPubkey);
  console.log(`  Registered adaptors: ${receipts.length}`);

  console.log('\n✅ All adaptors registered. Run init-strategies.ts next.');
  console.log('  npm run init-strategies');
}

main().catch((err) => {
  console.error('add-adaptors failed:', err);
  process.exit(1);
});
