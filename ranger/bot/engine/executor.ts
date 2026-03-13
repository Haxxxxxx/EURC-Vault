/**
 * Transaction Executor — builds and submits Ranger Earn vault strategy transactions.
 *
 * Uses @voltr/vault-sdk VoltrClient to:
 * - Withdraw from an underperforming protocol strategy
 * - Deposit into the highest-rate protocol strategy
 *
 * Handles:
 * - Versioned transaction construction
 * - Manager keypair signing
 * - Retry logic with exponential backoff
 * - Confirmation waiting
 *
 * Falls back to simulation mode when VAULT_ADDRESS is not set (demo/test).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  type TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';
import BN from 'bn.js';
import { VoltrClient, LENDING_ADAPTOR_PROGRAM_ID, DRIFT_ADAPTOR_PROGRAM_ID } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  VAULT_MANAGER_KEYPAIR_PATH,
  ACTIVE_MINT,
  ADAPTOR_IDS,
  STRATEGY_ADDRESSES,
  DRIFT_SPOT_MARKET_INDEX,
  DRIFT_ORACLE_ADDRESS,
  KAMINO_RESERVE_ADDRESS,
  SAVE_RESERVE_ADDRESS,
  SAVE_COUNTERPARTY_TA,
  SAVE_COLLATERAL_MINT,
  SAVE_LENDING_MARKET,
  SAVE_PYTH_ORACLE,
  SAVE_SWITCHBOARD_ORACLE,
} from '../config.js';
import {
  getSaveDepositRemainingAccounts,
  getDriftDepositRemainingAccounts,
  getKaminoDepositRemainingAccounts,
} from '../utils/remaining-accounts.js';
import type { ProtocolId, RebalanceDecision, VaultState } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:executor');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

const KAMINO_ADAPTOR_PROGRAM_ID = new PublicKey('to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR');

/** Map protocol → adaptor program PublicKey */
const PROTOCOL_TO_ADAPTOR_PUBKEY: Record<ProtocolId, PublicKey> = {
  save:   LENDING_ADAPTOR_PROGRAM_ID,
  drift:  DRIFT_ADAPTOR_PROGRAM_ID,
  kamino: KAMINO_ADAPTOR_PROGRAM_ID,
};

// Sanity-check adaptor IDs match config
if (LENDING_ADAPTOR_PROGRAM_ID.toBase58() !== ADAPTOR_IDS.lending) {
  log.warn('LENDING_ADAPTOR_PROGRAM_ID mismatch', {
    sdk:    LENDING_ADAPTOR_PROGRAM_ID.toBase58(),
    config: ADAPTOR_IDS.lending,
  });
}
if (DRIFT_ADAPTOR_PROGRAM_ID.toBase58() !== ADAPTOR_IDS.drift) {
  log.warn('DRIFT_ADAPTOR_PROGRAM_ID mismatch', {
    sdk:    DRIFT_ADAPTOR_PROGRAM_ID.toBase58(),
    config: ADAPTOR_IDS.drift,
  });
}

// ─── Keypair loading ──────────────────────────────────────────────────────────

let _managerKeypair: Keypair | null = null;

function getManagerKeypair(): Keypair {
  if (_managerKeypair) return _managerKeypair;

  if (!VAULT_MANAGER_KEYPAIR_PATH) {
    throw new Error(
      'VAULT_MANAGER_KEYPAIR_PATH not set — cannot sign transactions',
    );
  }

  const raw = JSON.parse(readFileSync(VAULT_MANAGER_KEYPAIR_PATH, 'utf-8')) as number[];
  _managerKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  log.info('Manager keypair loaded', { pubkey: _managerKeypair.publicKey.toBase58() });
  return _managerKeypair;
}

// ─── Transaction helpers ──────────────────────────────────────────────────────

/**
 * Send with retry — rebuilds the transaction with a fresh blockhash on every
 * attempt so expired-blockhash rejections (~90s TTL) don't permanently fail.
 */
async function sendWithRetry(
  connection: Connection,
  manager: Keypair,
  instructions: TransactionInstruction[],
  retries = MAX_RETRIES,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Fresh blockhash on every attempt — avoids expired-blockhash rejections
    const tx = await buildAndSign(connection, manager, instructions);
    try {
      const sig = await connection.sendTransaction(tx, {
        skipPreflight:       false,
        preflightCommitment: 'confirmed',
        maxRetries:          0,
      });

      log.debug('Transaction sent', { sig, attempt });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const result = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      if (result.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
      }

      log.info('Transaction confirmed', { sig });
      return sig;
    } catch (err) {
      if (attempt === retries) throw err;
      log.warn(`Transaction attempt ${attempt} failed, retrying...`, { err: String(err) });
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error('unreachable');
}

async function buildAndSign(
  connection: Connection,
  manager: Keypair,
  instructions: TransactionInstruction[],
): Promise<VersionedTransaction> {
  const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
  const priorityFee   = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 });

  const allIxs = [computeBudget, priorityFee, ...instructions];

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey:        manager.publicKey,
    recentBlockhash: blockhash,
    instructions:    allIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([manager]);
  return tx;
}

/** Resolve strategy address for a protocol — throws if not configured */
function getStrategyAddress(protocol: ProtocolId): PublicKey {
  const addr = STRATEGY_ADDRESSES[protocol];
  if (!addr) {
    throw new Error(
      `Strategy address for ${protocol} not set. ` +
      `Run init-strategies.ts and set ${protocol.toUpperCase()}_STRATEGY_ADDRESS in .env`,
    );
  }
  return new PublicKey(addr);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a rebalance: withdraw from `from` protocol, deposit into `to` protocol.
 *
 * Uses real VoltrClient strategy instructions when VAULT_ADDRESS is configured.
 * Falls back to simulation mode otherwise (safe for demo / CI).
 *
 * @returns transaction signature, or a "simulated_*" string in simulation mode
 */
export async function executeRebalance(
  decision: RebalanceDecision,
  vaultState: VaultState,
  connection?: Connection,
): Promise<string | null> {
  const conn = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');

  if (!decision.shouldRebalance) {
    log.debug('executeRebalance called with shouldRebalance=false — skipping');
    return null;
  }

  // Simulation mode — vault not yet deployed
  if (!VAULT_ADDRESS) {
    log.warn('Simulation mode: VAULT_ADDRESS not set — tx not sent', {
      wouldWithdraw: decision.lowestRateProtocol,
      wouldDeposit:  decision.highestRateProtocol,
    });
    return `simulated_${Date.now()}`;
  }

  const manager     = getManagerKeypair();
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const mintPubkey  = new PublicKey(ACTIVE_MINT);
  const client      = new VoltrClient(conn, manager);

  const fromProtocol = decision.lowestRateProtocol;
  const toProtocol   = decision.highestRateProtocol;

  // Calculate EURC amount to move
  const currentFraction  = decision.currentAllocation[fromProtocol];
  const targetFraction   = decision.targetAllocation[fromProtocol];
  const withdrawFraction = Math.max(0, currentFraction - targetFraction);
  const withdrawAmount   = Math.floor(vaultState.totalAssets * withdrawFraction);

  if (withdrawAmount === 0) {
    log.info('No withdrawal needed — allocation already optimal');
    return null;
  }

  log.info('Executing rebalance', {
    fromProtocol,
    toProtocol,
    withdrawAmount: `${(withdrawAmount / 1_000_000).toFixed(4)} EURC`,
    spreadBps: decision.spreadBps,
  });

  const fromStrategy   = getStrategyAddress(fromProtocol);
  const toStrategy     = getStrategyAddress(toProtocol);
  const fromAdaptor    = PROTOCOL_TO_ADAPTOR_PUBKEY[fromProtocol];
  const toAdaptor      = PROTOCOL_TO_ADAPTOR_PUBKEY[toProtocol];

  // Resolve protocol-specific remainingAccounts
  const { remainingAccounts: withdrawRemainingAccounts, additionalArgs: withdrawArgs } =
    await resolveStrategyAccounts(fromProtocol, 'withdraw', vaultPubkey, fromStrategy, conn, client);
  const { remainingAccounts: depositRemainingAccounts, additionalArgs: depositArgs } =
    await resolveStrategyAccounts(toProtocol, 'deposit', vaultPubkey, toStrategy, conn, client);

  const withdrawIx = await client.createWithdrawStrategyIx(
    {
      withdrawAmount:           new BN(withdrawAmount),
      instructionDiscriminator: null,
      additionalArgs:           withdrawArgs ?? null,
    },
    {
      manager:           manager.publicKey,
      vault:             vaultPubkey,
      vaultAssetMint:    mintPubkey,
      strategy:          fromStrategy,
      assetTokenProgram: TOKEN_PROGRAM_ID,
      adaptorProgram:    fromAdaptor,
      remainingAccounts: withdrawRemainingAccounts,
    },
  );

  const depositIx = await client.createDepositStrategyIx(
    {
      depositAmount:            new BN(withdrawAmount),
      instructionDiscriminator: null,
      additionalArgs:           depositArgs ?? null,
    },
    {
      manager:           manager.publicKey,
      vault:             vaultPubkey,
      vaultAssetMint:    mintPubkey,
      strategy:          toStrategy,
      assetTokenProgram: TOKEN_PROGRAM_ID,
      adaptorProgram:    toAdaptor,
      remainingAccounts: depositRemainingAccounts,
    },
  );

  return sendWithRetry(conn, manager, [withdrawIx, depositIx]);
}

/**
 * Emergency withdrawal — pulls all funds from a specific protocol back to idle.
 * Used by circuit breaker.
 */
export async function emergencyWithdrawAll(
  protocol: ProtocolId,
  vaultState: VaultState,
  connection?: Connection,
): Promise<string | null> {
  const conn = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');

  const amountMap: Record<ProtocolId, number> = {
    drift:  vaultState.driftAllocation,
    kamino: vaultState.kaminoAllocation,
    save:   vaultState.saveAllocation,
  };

  const amount = amountMap[protocol];
  if (amount === 0) {
    log.debug('emergencyWithdrawAll: no funds in protocol', { protocol });
    return null;
  }

  log.error(`EMERGENCY WITHDRAW from ${protocol}`, undefined, {
    amount: `${(amount / 1_000_000).toFixed(4)} EURC`,
  });

  // Simulation mode — vault not yet deployed
  if (!VAULT_ADDRESS) {
    log.warn('Simulation mode: emergency withdraw not sent');
    return `emergency_simulated_${Date.now()}`;
  }

  const manager     = getManagerKeypair();
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const mintPubkey  = new PublicKey(ACTIVE_MINT);
  const client      = new VoltrClient(conn, manager);

  const strategy = getStrategyAddress(protocol);
  const adaptor  = PROTOCOL_TO_ADAPTOR_PUBKEY[protocol];

  const { remainingAccounts, additionalArgs } =
    await resolveStrategyAccounts(protocol, 'withdraw', vaultPubkey, strategy, conn, client);

  const withdrawIx = await client.createWithdrawStrategyIx(
    {
      withdrawAmount:           new BN(amount),
      instructionDiscriminator: null,
      additionalArgs:           additionalArgs ?? null,
    },
    {
      manager:           manager.publicKey,
      vault:             vaultPubkey,
      vaultAssetMint:    mintPubkey,
      strategy,
      assetTokenProgram: TOKEN_PROGRAM_ID,
      adaptorProgram:    adaptor,
      remainingAccounts,
    },
  );

  return sendWithRetry(conn, manager, [withdrawIx]);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Resolve protocol-specific remainingAccounts and optional additionalArgs for a strategy instruction. */
async function resolveStrategyAccounts(
  protocol: ProtocolId,
  action: 'deposit' | 'withdraw',
  vault: PublicKey,
  strategy: PublicKey,
  conn: Connection,
  client: VoltrClient,
): Promise<{ remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]; additionalArgs?: Buffer }> {
  if (protocol === 'save') {
    if (!SAVE_COUNTERPARTY_TA || !SAVE_RESERVE_ADDRESS || !SAVE_COLLATERAL_MINT || !SAVE_PYTH_ORACLE || !SAVE_SWITCHBOARD_ORACLE) {
      log.warn('Save protocol env vars not fully set — using empty remainingAccounts', { protocol });
      return { remainingAccounts: [] };
    }
    const accounts = getSaveDepositRemainingAccounts({
      vault,
      strategy,
      counterPartyTa:     new PublicKey(SAVE_COUNTERPARTY_TA),
      reserve:            new PublicKey(SAVE_RESERVE_ADDRESS),
      lendingMarket:      new PublicKey(SAVE_LENDING_MARKET),
      collateralMint:     new PublicKey(SAVE_COLLATERAL_MINT),
      pythOracle:         new PublicKey(SAVE_PYTH_ORACLE),
      switchboardOracle:  new PublicKey(SAVE_SWITCHBOARD_ORACLE),
      vc: client,
    });
    return { remainingAccounts: accounts };
  }

  if (protocol === 'drift') {
    if (!DRIFT_ORACLE_ADDRESS) {
      log.warn('DRIFT_ORACLE_ADDRESS not set — using empty remainingAccounts', { protocol });
      return { remainingAccounts: [] };
    }
    return getDriftDepositRemainingAccounts({
      vault,
      strategy,
      marketIndex: DRIFT_SPOT_MARKET_INDEX,
      oracle:      new PublicKey(DRIFT_ORACLE_ADDRESS),
      vc: client,
    });
  }

  if (protocol === 'kamino') {
    if (!KAMINO_RESERVE_ADDRESS) {
      log.warn('KAMINO_RESERVE_ADDRESS not set — using empty remainingAccounts', { protocol });
      return { remainingAccounts: [] };
    }
    const accounts = await getKaminoDepositRemainingAccounts({
      vault,
      reserve:    new PublicKey(KAMINO_RESERVE_ADDRESS),
      connection: conn,
      vc: client,
    });
    return { remainingAccounts: accounts };
  }

  log.warn('Unknown protocol — using empty remainingAccounts', { protocol });
  return { remainingAccounts: [] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
