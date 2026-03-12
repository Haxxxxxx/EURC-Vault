/**
 * Risk Engine — monitors vault health and enforces concentration limits.
 *
 * Responsibilities:
 * - Track drawdown from peak TVL
 * - Enforce per-protocol concentration limits (10–70%)
 * - Flag high protocol utilization
 * - Produce a composite health score (0–100)
 * - Determine risk level: GREEN / YELLOW / RED / EMERGENCY
 */
import {
  MAX_ALLOCATION_PCT,
  MIN_ALLOCATION_PCT,
  CIRCUIT_BREAKER_DRAWDOWN_PCT,
  MAX_UTILIZATION,
} from '../config.js';
import type {
  VaultState,
  StrategyAllocation,
  RiskState,
  RiskLevel,
  ProtocolRate,
  ProtocolId,
} from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:risk');

/** Compute current allocation fractions from vault state */
export function computeAllocation(state: VaultState): StrategyAllocation {
  const total = state.totalAssets;
  if (total === 0) {
    return { drift: 0, kamino: 0, save: 0, idle: 1 };
  }
  return {
    drift:  state.driftAllocation  / total,
    kamino: state.kaminoAllocation / total,
    save:   state.saveAllocation   / total,
    idle:   state.idleBalance      / total,
  };
}

/** Compute current drawdown as a fraction of peak TVL */
export function computeDrawdown(state: VaultState): number {
  if (state.peakTvl === 0) return 0;
  const drawdown = (state.peakTvl - state.totalAssets) / state.peakTvl;
  return Math.max(0, drawdown);
}

/** Calculate composite health score (0 = worst, 100 = perfect) */
function computeHealthScore(
  drawdown: number,
  maxConcentration: number,
  utilizationWarnings: number,
): number {
  // Component weights: 50% drawdown, 30% concentration, 20% utilization
  const drawdownScore = Math.max(0, 100 - (drawdown / CIRCUIT_BREAKER_DRAWDOWN_PCT) * 50);
  const concentrationScore = Math.max(
    0,
    100 - ((maxConcentration - MAX_ALLOCATION_PCT) / (1 - MAX_ALLOCATION_PCT)) * 30,
  );
  const utilizationScore = Math.max(0, 100 - utilizationWarnings * 20);

  return Math.round(drawdownScore * 0.5 + concentrationScore * 0.3 + utilizationScore * 0.2);
}

/** Determine risk level from current state */
function classifyRiskLevel(
  drawdown: number,
  maxConcentration: number,
  utilizationWarnings: number,
  circuitBreakerTripped: boolean,
): RiskLevel {
  if (circuitBreakerTripped) return 'EMERGENCY';
  if (drawdown >= CIRCUIT_BREAKER_DRAWDOWN_PCT) return 'EMERGENCY';
  if (drawdown >= CIRCUIT_BREAKER_DRAWDOWN_PCT * 0.75) return 'RED';
  if (maxConcentration > MAX_ALLOCATION_PCT + 0.05) return 'RED';
  if (drawdown >= CIRCUIT_BREAKER_DRAWDOWN_PCT * 0.5) return 'YELLOW';
  if (maxConcentration > MAX_ALLOCATION_PCT) return 'YELLOW';
  if (utilizationWarnings > 0) return 'YELLOW';
  return 'GREEN';
}

/**
 * Full risk assessment.
 * Call this before every rebalance decision and on health check intervals.
 */
export function assessRisk(
  state: VaultState,
  rates: Record<ProtocolId, ProtocolRate>,
  circuitBreakerTripped: boolean,
): RiskState {
  const allocation = computeAllocation(state);
  const drawdown = computeDrawdown(state);

  const concentrations: Array<[ProtocolId, number]> = [
    ['drift',  allocation.drift],
    ['kamino', allocation.kamino],
    ['save',   allocation.save],
  ];

  const [mostConcentratedProtocol, highestConcentration] = concentrations.reduce(
    (best, [p, c]) => (c > best[1] ? [p, c] : best),
    ['drift' as ProtocolId, 0] as [ProtocolId, number],
  );

  // Flag protocols with high utilization
  const utilizationWarnings: string[] = [];
  for (const [protocol, rate] of Object.entries(rates) as Array<[ProtocolId, ProtocolRate]>) {
    if (rate.utilization > MAX_UTILIZATION) {
      utilizationWarnings.push(
        `${protocol} utilization ${(rate.utilization * 100).toFixed(1)}% > ${MAX_UTILIZATION * 100}%`,
      );
    }
  }

  // Concentration violations
  const concentrationWarnings: string[] = [];
  for (const [protocol, fraction] of concentrations) {
    if (fraction > MAX_ALLOCATION_PCT) {
      concentrationWarnings.push(
        `${protocol} at ${(fraction * 100).toFixed(1)}% exceeds max ${MAX_ALLOCATION_PCT * 100}%`,
      );
    }
  }

  const allWarnings = [...utilizationWarnings, ...concentrationWarnings];

  const level = classifyRiskLevel(
    drawdown,
    highestConcentration,
    utilizationWarnings.length,
    circuitBreakerTripped,
  );

  const healthScore = computeHealthScore(
    drawdown,
    highestConcentration,
    utilizationWarnings.length,
  );

  const riskState: RiskState = {
    level,
    drawdownPercent: drawdown,
    highestConcentration,
    mostConcentratedProtocol: highestConcentration > 0 ? mostConcentratedProtocol : null,
    utilizationWarnings: allWarnings,
    circuitBreakerTripped,
    healthScore,
  };

  const emoji = { GREEN: '✅', YELLOW: '⚠️', RED: '🔴', EMERGENCY: '🚨' }[level];
  log.info(`Risk assessment ${emoji}`, {
    level,
    drawdownPct: `${(drawdown * 100).toFixed(2)}%`,
    healthScore,
    topConcentration: `${mostConcentratedProtocol}@${(highestConcentration * 100).toFixed(1)}%`,
    warnings: allWarnings.length,
  });

  return riskState;
}

/** Check if current allocation violates min/max constraints */
export function hasConcentrationViolation(allocation: StrategyAllocation): boolean {
  const active: Array<keyof Omit<StrategyAllocation, 'idle'>> = ['drift', 'kamino', 'save'];
  for (const p of active) {
    if (allocation[p] > MAX_ALLOCATION_PCT) return true;
    // Only flag min violation if the protocol has non-zero allocation
    if (allocation[p] > 0 && allocation[p] < MIN_ALLOCATION_PCT) return true;
  }
  return false;
}
