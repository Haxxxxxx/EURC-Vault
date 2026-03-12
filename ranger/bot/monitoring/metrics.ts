/**
 * Metrics Calculator — tracks APY, PnL, rebalance counts, and health scores.
 *
 * Uses time-weighted return (TWR) methodology for APY calculation,
 * which handles irregular cash flows correctly.
 *
 * Snapshots are written to Firestore for the frontend to consume.
 */
import type { VaultState, MetricsSnapshot, ProtocolId } from '../types.js';
import type { AggregatedRates } from '../rates/aggregator.js';
import { assessRisk } from '../engine/risk.js';
import type { ProtocolRate } from '../types.js';
import logger from './logger.js';

const log = logger.child('monitoring:metrics');

// In-memory TWR tracking (sub-period returns since vault inception)
interface TwrPeriod {
  startValue: number;
  endValue:   number;
  startTime:  Date;
  endTime:    Date;
}

const twrPeriods: TwrPeriod[] = [];
let lastSnapshotTvl = 0;
let lastSnapshotTime: Date | null = null;

// Rolling 24h event counters
const eventLog: Array<{ type: 'rebalance' | 'compound'; timestamp: Date }> = [];

export function recordRebalanceEvent(): void {
  eventLog.push({ type: 'rebalance', timestamp: new Date() });
  pruneEventLog();
}

export function recordCompoundEvent(): void {
  eventLog.push({ type: 'compound', timestamp: new Date() });
  pruneEventLog();
}

function pruneEventLog(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
  while (eventLog.length > 0 && eventLog[0].timestamp.getTime() < cutoff) {
    eventLog.shift();
  }
}

function countEvents(type: 'rebalance' | 'compound'): number {
  return eventLog.filter((e) => e.type === type).length;
}

/**
 * Record a TWR sub-period. Call at the start of each metrics snapshot.
 */
export function recordTwrPeriod(currentTvl: number): void {
  if (lastSnapshotTvl === 0 || lastSnapshotTime === null) {
    lastSnapshotTvl  = currentTvl;
    lastSnapshotTime = new Date();
    return;
  }

  const period: TwrPeriod = {
    startValue: lastSnapshotTvl,
    endValue:   currentTvl,
    startTime:  lastSnapshotTime,
    endTime:    new Date(),
  };

  twrPeriods.push(period);
  // Keep last 7 days of periods
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1_000;
  while (twrPeriods.length > 0 && twrPeriods[0].startTime.getTime() < cutoff) {
    twrPeriods.shift();
  }

  lastSnapshotTvl  = currentTvl;
  lastSnapshotTime = new Date();
}

/**
 * Calculate annualized APY using time-weighted return methodology.
 *
 * TWR = product of (1 + sub-period return) for all periods
 * APY = TWR ^ (365 / days_elapsed) - 1
 */
export function calculateApy(): number {
  if (twrPeriods.length < 2) return 0;

  let twr = 1;
  let totalMs = 0;

  for (const period of twrPeriods) {
    if (period.startValue === 0) continue;
    const subReturn = (period.endValue - period.startValue) / period.startValue;
    twr *= 1 + subReturn;
    totalMs += period.endTime.getTime() - period.startTime.getTime();
  }

  if (totalMs === 0) return 0;

  const yearsElapsed = totalMs / (365.25 * 24 * 60 * 60 * 1_000);
  const apy = Math.pow(twr, 1 / yearsElapsed) - 1;

  return Math.max(0, apy);
}

/**
 * Generate a full metrics snapshot for logging/Firestore.
 */
export function generateSnapshot(
  vaultState: VaultState,
  rates: AggregatedRates,
  circuitBreakerTripped: boolean,
): MetricsSnapshot {
  recordTwrPeriod(vaultState.totalAssets);

  const ratesByProtocol: Record<ProtocolId, ProtocolRate> = {
    drift:  rates.drift,
    kamino: rates.kamino,
    save:   rates.save,
  };

  const riskState = assessRisk(vaultState, ratesByProtocol, circuitBreakerTripped);
  const apy       = calculateApy();
  const total     = vaultState.totalAssets;

  const snapshot: MetricsSnapshot = {
    totalTvl:         total,
    currentApy:       apy,
    driftAllocation:  total > 0 ? vaultState.driftAllocation  / total : 0,
    kaminoAllocation: total > 0 ? vaultState.kaminoAllocation / total : 0,
    saveAllocation:   total > 0 ? vaultState.saveAllocation   / total : 0,
    idleAllocation:   total > 0 ? vaultState.idleBalance       / total : 0,
    drawdownPercent:  riskState.drawdownPercent,
    healthScore:      riskState.healthScore,
    rebalanceCount24h: countEvents('rebalance'),
    compoundCount24h:  countEvents('compound'),
    timestamp:        new Date(),
  };

  log.info('Metrics snapshot', {
    tvl:       `${(total / 1_000_000).toFixed(2)} EURC`,
    apy:       `${(apy * 100).toFixed(2)}%`,
    health:    riskState.healthScore,
    rebalances24h: snapshot.rebalanceCount24h,
    compounds24h:  snapshot.compoundCount24h,
  });

  return snapshot;
}
