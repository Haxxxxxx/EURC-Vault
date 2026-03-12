/**
 * init-strategies.ts — Initialize lending positions on each protocol.
 *
 * This is the protocol-specific account setup required before the
 * bot can deposit/withdraw via each adaptor. Each protocol needs
 * its strategy account initialized on-chain.
 *
 * Usage: npm run init-strategies
 *
 * After running, set strategy addresses in .env:
 *   DRIFT_STRATEGY_ADDRESS=...
 *   KAMINO_STRATEGY_ADDRESS=...
 *   SAVE_STRATEGY_ADDRESS=...
 *
 * Required env vars (protocol-specific, set before running):
 *   Save:   SAVE_LENDING_MARKET, SAVE_COUNTERPARTY_TA, SAVE_COLLATERAL_MINT
 *   Drift:  DRIFT_SPOT_MARKET_INDEX (default: 15)
 *   Kamino: KAMINO_RESERVE_ADDRESS
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
import { VoltrClient, LENDING_ADAPTOR_PROGRAM_ID } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  VAULT_MANAGER_KEYPAIR_PATH,
  ADAPTOR_IDS,
  DRIFT_SPOT_MARKET_INDEX,
  KAMINO_RESERVE_ADDRESS,
  SAVE_RESERVE_ADDRESS,
  SAVE_LENDING_MARKET,
  SAVE_COUNTERPARTY_TA,
  SAVE_COLLATERAL_MINT,
  SOLANA_CLUSTER,
} from '../bot/config.js';
import {
  getSaveStrategyPDA,
  getSaveInitRemainingAccounts,
  getDriftStrategyPDA,
  getDriftInitRemainingAccounts,
  getKaminoStrategyAddress,
  getKaminoInitRemainingAccounts,
} from '../bot/utils/remaining-accounts.js';

const KAMINO_ADAPTOR_PROGRAM_ID = new PublicKey('to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR');

function loadKeypair(path: string): Keypair {
  if (!path) throw new Error('Manager keypair path not set');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  EURC Yield Optimizer — Initialize Strategies');
  console.log(`  Cluster: ${SOLANA_CLUSTER}`);
  console.log('═══════════════════════════════════════════════\n');

  if (!VAULT_ADDRESS) {
    throw new Error('VAULT_ADDRESS not set — run create-vault.ts first');
  }

  const connection  = new Connection(SOLANA_RPC_URL, 'confirmed');
  const manager     = loadKeypair(VAULT_MANAGER_KEYPAIR_PATH);
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const client      = new VoltrClient(connection, manager);

  console.log(`Vault:   ${VAULT_ADDRESS}`);
  console.log(`Manager: ${manager.publicKey.toBase58()}\n`);

  // ── Drift Strategy ──────────────────────────────────────────────────────────
  console.log('1. Initializing Drift Strategy');
  console.log(`   Adaptor: ${ADAPTOR_IDS.lending}  (uses LENDING_ADAPTOR)`);
  console.log(`   Spot Market Index: ${DRIFT_SPOT_MARKET_INDEX}`);

  const driftStrategy = getDriftStrategyPDA(DRIFT_SPOT_MARKET_INDEX);
  console.log(`   Strategy PDA: ${driftStrategy.toBase58()}`);

  const driftInitAccounts = getDriftInitRemainingAccounts({
    vault: vaultPubkey,
    strategy: driftStrategy,
    marketIndex: DRIFT_SPOT_MARKET_INDEX,
    vc: client,
  });

  const driftInitIx = await client.createInitializeStrategyIx(
    { instructionDiscriminator: null, additionalArgs: null },
    {
      payer:             manager.publicKey,
      vault:             vaultPubkey,
      manager:           manager.publicKey,
      strategy:          driftStrategy,
      remainingAccounts: driftInitAccounts,
      // adaptorProgram defaults to LENDING_ADAPTOR_PROGRAM_ID
    },
  );
  const driftTx  = new Transaction().add(driftInitIx);
  const driftSig = await sendAndConfirmTransaction(connection, driftTx, [manager], { commitment: 'confirmed' });
  console.log(`   ✅ Drift strategy initialized: ${driftStrategy.toBase58()}`);
  console.log(`   TX: ${driftSig}`);
  console.log(`   Add to .env: DRIFT_STRATEGY_ADDRESS=${driftStrategy.toBase58()}\n`);

  // ── Kamino Strategy ─────────────────────────────────────────────────────────
  console.log('2. Initializing Kamino Strategy');
  console.log(`   Adaptor: ${ADAPTOR_IDS.kamino}`);

  if (!KAMINO_RESERVE_ADDRESS) {
    console.log('   ⚠️  KAMINO_RESERVE_ADDRESS not set in .env — skipping\n');
  } else {
    const kaminoReserve   = new PublicKey(KAMINO_RESERVE_ADDRESS);
    const kaminoStrategy  = getKaminoStrategyAddress(kaminoReserve);
    console.log(`   Reserve / Strategy: ${kaminoStrategy.toBase58()}`);

    const kaminoInitAccounts = await getKaminoInitRemainingAccounts({
      vault:      vaultPubkey,
      reserve:    kaminoReserve,
      connection,
      vc: client,
    });

    const kaminoInitIx = await client.createInitializeStrategyIx(
      { instructionDiscriminator: null, additionalArgs: null },
      {
        payer:             manager.publicKey,
        vault:             vaultPubkey,
        manager:           manager.publicKey,
        strategy:          kaminoStrategy,
        adaptorProgram:    KAMINO_ADAPTOR_PROGRAM_ID,
        remainingAccounts: kaminoInitAccounts,
      },
    );
    const kaminoTx  = new Transaction().add(kaminoInitIx);
    const kaminoSig = await sendAndConfirmTransaction(connection, kaminoTx, [manager], { commitment: 'confirmed' });
    console.log(`   ✅ Kamino strategy initialized: ${kaminoStrategy.toBase58()}`);
    console.log(`   TX: ${kaminoSig}`);
    console.log(`   Add to .env: KAMINO_STRATEGY_ADDRESS=${kaminoStrategy.toBase58()}\n`);
  }

  // ── Save Strategy ───────────────────────────────────────────────────────────
  console.log('3. Initializing Save/Lending Strategy');
  console.log(`   Adaptor: ${ADAPTOR_IDS.lending}`);

  if (!SAVE_COUNTERPARTY_TA || !SAVE_COLLATERAL_MINT) {
    console.log('   ⚠️  SAVE_COUNTERPARTY_TA or SAVE_COLLATERAL_MINT not set in .env — skipping');
    console.log(`   Reserve: ${SAVE_RESERVE_ADDRESS || '(set SAVE_RESERVE_ADDRESS in .env)'}\n`);
  } else {
    const saveCounterPartyTa = new PublicKey(SAVE_COUNTERPARTY_TA);
    const saveStrategy       = getSaveStrategyPDA(saveCounterPartyTa);
    const saveLendingMkt     = new PublicKey(SAVE_LENDING_MARKET);
    const saveCollateralMint = new PublicKey(SAVE_COLLATERAL_MINT);
    console.log(`   Strategy PDA: ${saveStrategy.toBase58()}`);

    const saveInitAccounts = getSaveInitRemainingAccounts({
      vault:         vaultPubkey,
      strategy:      saveStrategy,
      lendingMarket: saveLendingMkt,
      collateralMint: saveCollateralMint,
      vc: client,
    });

    const saveInitIx = await client.createInitializeStrategyIx(
      { instructionDiscriminator: null, additionalArgs: null },
      {
        payer:             manager.publicKey,
        vault:             vaultPubkey,
        manager:           manager.publicKey,
        strategy:          saveStrategy,
        remainingAccounts: saveInitAccounts,
        // adaptorProgram defaults to LENDING_ADAPTOR_PROGRAM_ID
      },
    );
    const saveTx  = new Transaction().add(saveInitIx);
    const saveSig = await sendAndConfirmTransaction(connection, saveTx, [manager], { commitment: 'confirmed' });
    console.log(`   ✅ Save strategy initialized: ${saveStrategy.toBase58()}`);
    console.log(`   TX: ${saveSig}`);
    console.log(`   Add to .env: SAVE_STRATEGY_ADDRESS=${saveStrategy.toBase58()}\n`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('Next steps:');
  console.log('  1. Set strategy addresses printed above in .env');
  console.log('  2. Run: npm run seed-deposit');

  // Suppress unused import warnings
  void LENDING_ADAPTOR_PROGRAM_ID;
}

main().catch((err) => {
  console.error('init-strategies failed:', err);
  process.exit(1);
});
