/**
 * Rebalancing Engine — determines optimal capital allocation across protocols.
 *
 * Logic:
 * 1. Compare current rates — find best and worst protocol
 * 2. If spread < MIN_SPREAD_BPS → no rebalance needed
 * 3. If cooldown hasn't elapsed → skip
 * 4. Compute target allocation: concentrate in best, keep mins in others, reserve idle buffer
 * 5. Return a RebalanceDecision with current → target deltas
 *
 * Execution is handled by executor.ts (separate concern).
 */
import {
  REBALANCE_MIN_SPREAD_BPS,
  MAX_ALLOCATION_PCT,
  MIN_ALLOCATION_PCT,
  IDLE_RESERVE_PCT,
  REBALANCE_COOLDOWN_MS,
  MAX_REBALANCE_PCT_PER_CYCLE,
  MAX_UTILIZATION,
} from '../config.js';
import type {
  VaultState,
  StrategyAllocation,
  RebalanceDecision,
  ProtocolId,
  ProtocolRate,
} from '../types.js';
import { computeAllocation } from './risk.js';
import type { AggregatedRates } from '../rates/aggregator.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:rebalancer');

/**
 * Compute the optimal target allocation given current rates and constraints.
 *
 * Strategy: Concentrate on the highest-rate protocol (up to MAX_ALLOCATION_PCT),
 * keep MIN_ALLOCATION_PCT in each active protocol, hold IDLE_RESERVE_PCT idle.
 */
export function computeTargetAllocation(
  rates: AggregatedRates,
  currentAllocation: StrategyAllocation,
): StrategyAllocation {
  const protocols: ProtocolId[] = ['drift', 'kamino', 'save'];

  // Exclude protocols with excessive utilization from active allocation
  const activeProtocols = protocols.filter(
    (p) => rates[p].utilization <= MAX_UTILIZATION,
  );

  // Edge case: all protocols have high utilization — keep everything idle
  if (activeProtocols.length === 0) {
    log.warn('All protocols at max utilization — routing to idle');
    return { drift: 0, kamino: 0, save: 0, idle: 1 };
  }

  // Sort active protocols by APY descending
  const ranked = [...activeProtocols].sort((a, b) => rates[b].apy - rates[a].apy);
  const best = ranked[0];

  // Allocatable = everything not in idle reserve
  const allocatable = 1 - IDLE_RESERVE_PCT;

  // Give minimums to all active protocols except the best
  const othersMin = (ranked.length - 1) * MIN_ALLOCATION_PCT;
  const bestAlloc = Math.min(MAX_ALLOCATION_PCT, allocatable - othersMin);
  const otherAlloc = MIN_ALLOCATION_PCT;

  const target: StrategyAllocation = { drift: 0, kamino: 0, save: 0, idle: IDLE_RESERVE_PCT };

  target[best] = bestAlloc;
  for (const p of ranked.slice(1)) {
    target[p] = otherAlloc;
  }

  // Zero out inactive (high utilization) protocols — their funds go to idle
  for (const p of protocols) {
    if (!activeProtocols.includes(p)) {
      target[p] = 0;
    }
  }

  // Normalize to sum = 1.0 (floating point safety)
  const total = target.drift + target.kamino + target.save + target.idle;
  if (Math.abs(total - 1.0) > 0.001) {
    const excess = total - 1.0;
    target.idle -= excess;
  }

  return target;
}

/**
 * Apply the per-cycle move limit: don't shift more than MAX_REBALANCE_PCT_PER_CYCLE
 * of TVL in a single operation to avoid excessive slippage/gas.
 */
function applyMoveCap(
  current: StrategyAllocation,
  target: StrategyAllocation,
): StrategyAllocation {
  const protocols: Array<keyof StrategyAllocation> = ['drift', 'kamino', 'save', 'idle'];
  const capped: StrategyAllocation = { ...target };

  let totalMoveNeeded = 0;
  for (const p of protocols) {
    totalMoveNeeded += Math.max(0, target[p] - current[p]);
  }

  if (totalMoveNeeded <= MAX_REBALANCE_PCT_PER_CYCLE) {
    return capped;
  }

  // Scale down all moves proportionally
  const scale = MAX_REBALANCE_PCT_PER_CYCLE / totalMoveNeeded;
  for (const p of protocols) {
    const delta = target[p] - current[p];
    capped[p] = current[p] + delta * scale;
  }

  return capped;
}

/**
 * Main entry point: evaluate whether a rebalance should happen and what it should do.
 */
export function evaluateRebalance(
  vaultState: VaultState,
  rates: AggregatedRates,
  lastRebalanceAt: Date | null,
): RebalanceDecision {
  const currentAllocation = computeAllocation(vaultState);

  // ── Cooldown check ─────────────────────────────────────────────────────────
  if (lastRebalanceAt) {
    const msSinceLast = Date.now() - lastRebalanceAt.getTime();
    if (msSinceLast < REBALANCE_COOLDOWN_MS) {
      const remaining = Math.ceil((REBALANCE_COOLDOWN_MS - msSinceLast) / 60_000);
      return noRebalance(
        currentAllocation,
        rates,
        `Cooldown active — ${remaining} min remaining`,
      );
    }
  }

  // ── Spread check ───────────────────────────────────────────────────────────
  if (rates.spreadBps < REBALANCE_MIN_SPREAD_BPS) {
    return noRebalance(
      currentAllocation,
      rates,
      `Spread ${rates.spreadBps} bps < minimum ${REBALANCE_MIN_SPREAD_BPS} bps — staying diversified`,
    );
  }

  // ── Skip if vault is empty ─────────────────────────────────────────────────
  if (vaultState.totalAssets === 0) {
    return noRebalance(currentAllocation, rates, 'Vault has no assets');
  }

  // ── Compute optimal target ─────────────────────────────────────────────────
  const rawTarget = computeTargetAllocation(rates, currentAllocation);
  const cappedTarget = applyMoveCap(currentAllocation, rawTarget);

  // ── Estimate annualized gain ───────────────────────────────────────────────
  const currentBlendedApy =
    currentAllocation.drift  * rates.drift.apy  +
    currentAllocation.kamino * rates.kamino.apy +
    currentAllocation.save   * rates.save.apy;

  const targetBlendedApy =
    cappedTarget.drift  * rates.drift.apy  +
    cappedTarget.kamino * rates.kamino.apy +
    cappedTarget.save   * rates.save.apy;

  const estimatedGain = targetBlendedApy - currentBlendedApy;

  log.info('Rebalance decision: EXECUTE', {
    spreadBps: rates.spreadBps,
    best: rates.best,
    currentApy: `${(currentBlendedApy * 100).toFixed(2)}%`,
    targetApy:  `${(targetBlendedApy  * 100).toFixed(2)}%`,
    gainBps: Math.round(estimatedGain * 10_000),
  });

  return {
    shouldRebalance:         true,
    reason:                  `Spread ${rates.spreadBps} bps ≥ threshold — routing to ${rates.best}`,
    currentAllocation,
    targetAllocation:        cappedTarget,
    spreadBps:               rates.spreadBps,
    estimatedGainAnnualized: estimatedGain,
    highestRateProtocol:     rates.best,
    lowestRateProtocol:      rates.worst,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function noRebalance(
  currentAllocation: StrategyAllocation,
  rates: AggregatedRates,
  reason: string,
): RebalanceDecision {
  log.debug('No rebalance', { reason, spreadBps: rates.spreadBps });
  return {
    shouldRebalance:         false,
    reason,
    currentAllocation,
    targetAllocation:        currentAllocation,
    spreadBps:               rates.spreadBps,
    estimatedGainAnnualized: 0,
    highestRateProtocol:     rates.best,
    lowestRateProtocol:      rates.worst,
  };
}
