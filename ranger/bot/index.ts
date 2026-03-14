/**
 * EURC Cross-Protocol Yield Optimizer — Bot Entry Point
 *
 * Main loop:
 *   Every 5 min  → fetch rates, health check
 *   Every 15 min → evaluate + execute rebalance, snap metrics
 *   Every 1 hour → auto-compound
 *
 * Run locally: npm run bot
 * Deploy:      Firebase Cloud Functions (functions/src/ranger/)
 */
import 'dotenv/config';
import { Connection } from '@solana/web3.js';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  RATE_FETCH_INTERVAL_MS,
  REBALANCE_INTERVAL_MS,
  COMPOUND_INTERVAL_MS,
  HEALTH_CHECK_INTERVAL_MS,
  METRICS_SNAP_INTERVAL_MS,
} from './config.js';

import { fetchAllRates, hasStaleRates } from './rates/aggregator.js';
import { evaluateRebalance }    from './engine/rebalancer.js';
import { executeRebalance, emergencyWithdrawAll } from './engine/executor.js';
import { assessRisk }           from './engine/risk.js';
import * as cb                  from './engine/circuit-breaker.js';
import { runCompound, shouldCompound, setLastRecordedTvl } from './engine/compounder.js';
import { fetchVaultState } from './engine/vault-reader.js';
import { generateSnapshot }     from './monitoring/metrics.js';
import { recordRebalanceEvent, recordCompoundEvent } from './monitoring/metrics.js';
import { sendAlert, alertRiskWarning } from './monitoring/alerts.js';
import logger                   from './monitoring/logger.js';

import type { VaultState, ProtocolId } from './types.js';
import type { AggregatedRates } from './rates/aggregator.js';

const log = logger.child('bot');

// ─── Vault state reader (mock when VAULT_ADDRESS not set) ─────────────────────

function getMockVaultState(): VaultState {
  // Simulates a live vault for local development/testing
  return {
    totalAssets:      100_000 * 1_000_000, // 100K EURC
    totalShares:      100_000 * 1_000_000,
    driftAllocation:   60_000 * 1_000_000, // 60%
    kaminoAllocation:  25_000 * 1_000_000, // 25%
    saveAllocation:    10_000 * 1_000_000, // 10%
    idleBalance:        5_000 * 1_000_000, // 5%
    peakTvl:          100_000 * 1_000_000,
    lastRebalanceAt:  null,
    lastCompoundAt:   null,
  };
}

async function getVaultState(connection: Connection): Promise<VaultState> {
  if (!VAULT_ADDRESS) {
    log.warn('VAULT_ADDRESS not set — using mock vault state');
    return getMockVaultState();
  }
  return fetchVaultState(connection);
}

// ─── Bot loop tasks ───────────────────────────────────────────────────────────

/** Cached rates (updated every RATE_FETCH_INTERVAL_MS) */
let cachedRates: AggregatedRates | null = null;
/** Last rebalance time (for cooldown enforcement) */
let lastRebalanceAt: Date | null = null;

async function fetchRatesTask(connection: Connection): Promise<void> {
  try {
    cachedRates = await fetchAllRates(connection);
  } catch (err) {
    log.error('Rate fetch task failed', err);
  }
}

async function rebalanceTask(connection: Connection): Promise<void> {
  if (!cachedRates) {
    log.warn('No rates cached yet — skipping rebalance check');
    return;
  }

  if (cb.isTripped()) {
    log.warn('Circuit breaker tripped — rebalancing suspended');
    return;
  }

  // Never rebalance on stale or mock rate data
  if (hasStaleRates(cachedRates)) {
    log.warn('Stale rates detected — skipping rebalance to prevent misallocation');
    return;
  }

  // Guard against any rate marked isStale (mock/fallback rates)
  const staleProtocols = (['drift', 'kamino', 'save'] as const).filter((p) => cachedRates[p].isStale);
  if (staleProtocols.length > 0) {
    log.warn('Rate data includes stale/mock values — skipping rebalance', { stale: staleProtocols });
    return;
  }

  try {
    const vaultState = await getVaultState(connection);
    cb.updatePeakTvl(vaultState.totalAssets);

    const ratesByProtocol: Record<ProtocolId, import('./types.js').ProtocolRate> = {
      drift:  cachedRates.drift,
      kamino: cachedRates.kamino,
      save:   cachedRates.save,
    };

    const riskState = assessRisk(vaultState, ratesByProtocol, cb.isTripped());

    // Circuit breaker evaluation
    const newlyTripped = await cb.evaluate(vaultState, riskState);
    if (newlyTripped) {
      log.error('Circuit breaker tripped during rebalance check — executing emergency withdrawal');
      for (const protocol of ['drift', 'kamino', 'save'] as ProtocolId[]) {
        await emergencyWithdrawAll(protocol, vaultState, connection);
      }
      return;
    }

    // Risk warnings
    if (riskState.utilizationWarnings.length > 0) {
      await alertRiskWarning(riskState.utilizationWarnings);
    }

    // Rebalance decision
    const decision = evaluateRebalance(vaultState, cachedRates, lastRebalanceAt);

    if (decision.shouldRebalance) {
      const txSig = await executeRebalance(decision, vaultState, connection);
      if (txSig) {
        lastRebalanceAt = new Date();
        recordRebalanceEvent();
        log.info('Rebalance complete', {
          txSig,
          from:  decision.lowestRateProtocol,
          to:    decision.highestRateProtocol,
          spreadBps: decision.spreadBps,
        });
      }
    }
  } catch (err) {
    log.error('Rebalance task failed', err);
  }
}

async function compoundTask(connection: Connection): Promise<void> {
  if (!cachedRates) return;
  if (cb.isTripped()) return;

  try {
    const vaultState = await getVaultState(connection);

    // Only set the initial TVL baseline on first run (when _lastRecordedTvl is 0).
    // After that, the compounder updates _lastRecordedTvl after each successful compound.
    // Setting it every cycle would defeat accrual detection (currentTvl - baseline = 0).
    const check = shouldCompound(vaultState.totalAssets);
    if (!check.should && check.reason.includes('No baseline')) {
      setLastRecordedTvl(vaultState.totalAssets);
      log.info('Compound baseline TVL set', { tvl: (vaultState.totalAssets / 1_000_000).toFixed(2) });
      return;
    }

    const event = await runCompound(
      vaultState,
      cachedRates,
      async (harvestedAmount, fromProtocol, toProtocol) => {
        if (!VAULT_ADDRESS) {
          log.info('Compound tx (simulated — no vault address)', {
            harvested: (harvestedAmount / 1_000_000).toFixed(4),
            from: fromProtocol,
            to:   toProtocol,
          });
          return `compound_sim_${Date.now()}`;
        }

        // Real compound: withdraw from source, deposit to highest-rate protocol
        const compoundDecision = {
          shouldRebalance:      true,
          lowestRateProtocol:   fromProtocol,
          highestRateProtocol:  toProtocol,
          withdrawAmount:       harvestedAmount,
          spreadBps:            0,
          currentBlendedApyPct: 0,
          targetBlendedApyPct:  0,
          estimatedGainBps:     0,
        };
        const txSig = await executeRebalance(compoundDecision, vaultState, connection);
        log.info('Compound tx executed', {
          txSig,
          harvested: (harvestedAmount / 1_000_000).toFixed(4),
          from: fromProtocol,
          to:   toProtocol,
        });
        return txSig ?? `compound_failed_${Date.now()}`;
      },
    );

    if (event?.success) {
      recordCompoundEvent();
    }
  } catch (err) {
    log.error('Compound task failed', err);
  }
}

async function healthCheckTask(connection: Connection): Promise<void> {
  if (!cachedRates) return;

  try {
    const vaultState = await getVaultState(connection);
    const ratesByProtocol: Record<ProtocolId, import('./types.js').ProtocolRate> = {
      drift:  cachedRates.drift,
      kamino: cachedRates.kamino,
      save:   cachedRates.save,
    };

    const riskState = assessRisk(vaultState, ratesByProtocol, cb.isTripped());

    if (riskState.level === 'RED') {
      await sendAlert({
        level:   'ERROR',
        title:   'Vault Risk Level: RED',
        message: `Health score: ${riskState.healthScore}/100`,
        fields: {
          Drawdown:    `${(riskState.drawdownPercent * 100).toFixed(2)}%`,
          Concentrated: `${riskState.mostConcentratedProtocol ?? 'N/A'} @ ${(riskState.highestConcentration * 100).toFixed(1)}%`,
        },
      });
    }

    if (riskState.level === 'EMERGENCY' && !cb.isTripped()) {
      await cb.trip('Health check detected EMERGENCY level', vaultState);
    }
  } catch (err) {
    log.error('Health check task failed', err);
  }
}

async function metricsSnapTask(connection: Connection): Promise<void> {
  if (!cachedRates) return;

  try {
    const vaultState = await getVaultState(connection);
    const snapshot = generateSnapshot(vaultState, cachedRates, cb.isTripped());

    // Write to Firestore if configured
    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();
        await db.collection('ranger_metrics').doc('latest').set(snapshot);
        await db.collection('ranger_metrics').add(snapshot);
        log.debug('Metrics snapshot persisted to Firestore');
      } catch (fsErr) {
        log.warn('Firestore write failed — metrics snapshot not persisted', fsErr);
      }
    } else {
      log.debug('Metrics snapshot generated (Firestore not configured)', {
        blendedApy: `${snapshot.currentApyPct?.toFixed(2) ?? 0}%`,
      });
    }
  } catch (err) {
    log.error('Metrics snap task failed', err);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info('🚀 EURC Cross-Protocol Yield Optimizer starting up', {
    cluster:    process.env.SOLANA_CLUSTER ?? 'devnet',
    vaultAddr:  VAULT_ADDRESS || '(not set — simulation mode)',
  });

  if (!VAULT_ADDRESS) {
    log.warn('Running in SIMULATION MODE — no vault address configured');
  }

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

  // Initial rate fetch before starting loops
  await fetchRatesTask(connection);

  // Schedule recurring tasks
  const intervals = [
    setInterval(() => void fetchRatesTask(connection),   RATE_FETCH_INTERVAL_MS),
    setInterval(() => void rebalanceTask(connection),    REBALANCE_INTERVAL_MS),
    setInterval(() => void compoundTask(connection),     COMPOUND_INTERVAL_MS),
    setInterval(() => void healthCheckTask(connection),  HEALTH_CHECK_INTERVAL_MS),
    setInterval(() => void metricsSnapTask(connection),  METRICS_SNAP_INTERVAL_MS),
  ];

  // Run an immediate rebalance check on startup
  await rebalanceTask(connection);

  log.info('Bot running', {
    rateFetchEvery:  `${RATE_FETCH_INTERVAL_MS  / 60_000} min`,
    rebalanceEvery:  `${REBALANCE_INTERVAL_MS   / 60_000} min`,
    compoundEvery:   `${COMPOUND_INTERVAL_MS    / 60_000} min`,
    healthEvery:     `${HEALTH_CHECK_INTERVAL_MS / 60_000} min`,
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down bot...');
    intervals.forEach(clearInterval);
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    log.info('SIGTERM received — shutting down');
    intervals.forEach(clearInterval);
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Fatal bot error', err);
  process.exit(1);
});
