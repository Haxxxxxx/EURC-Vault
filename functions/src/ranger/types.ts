/**
 * Ranger Firebase Functions — Shared Types
 *
 * Mirrors the core types from ranger/bot/types.ts but self-contained
 * so the functions package has no cross-package dependency on ranger/.
 */

export type ProtocolId = "drift" | "kamino" | "save";
export type RiskLevel = "GREEN" | "YELLOW" | "RED" | "EMERGENCY";

/** A single protocol's current EURC supply rate snapshot */
export interface RangerRate {
  protocol: ProtocolId;
  /** Decimal APY (0.08 = 8%) */
  apy: number;
  /** Basis-point APY (800 = 8%) */
  apyBps: number;
  /** Pool utilization ratio 0–1 */
  utilization: number;
  /** Whether this rate is a stale/fallback value */
  isStale: boolean;
  /** Unix ms timestamp of fetch */
  fetchedAt: number;
}

/** Aggregated rates stored in Firestore `ranger_rates/latest` */
export interface RangerRatesDoc {
  drift: RangerRate;
  kamino: RangerRate;
  save: RangerRate;
  best: ProtocolId;
  worst: ProtocolId;
  /** Spread between best and worst in bps */
  spreadBps: number;
  /** Unix ms timestamp */
  fetchedAt: number;
}

/** Rebalance event stored in `ranger_rebalances` */
export interface RebalanceRecord {
  decision: "REBALANCE" | "SKIP";
  reason: string;
  spreadBps: number;
  highestRateProtocol: ProtocolId;
  lowestRateProtocol: ProtocolId;
  currentBlendedApyPct: number;
  targetBlendedApyPct: number;
  estimatedGainBps: number;
  txSig?: string;
  error?: string;
  timestamp: number;
}

/** Compound event stored in `ranger_compounds` */
export interface CompoundRecord {
  harvestedEurc: number;
  redeployedToProtocol: ProtocolId;
  apyAtRedeployPct: number;
  txSig?: string;
  error?: string;
  timestamp: number;
}

/** Health check result stored in `ranger_health` */
export interface HealthRecord {
  level: RiskLevel;
  healthScore: number;
  drawdownPct: number;
  highestConcentrationProtocol: ProtocolId | null;
  highestConcentrationPct: number;
  utilizationWarnings: ProtocolId[];
  circuitBreakerTripped: boolean;
  alertSent: boolean;
  timestamp: number;
}

/** Metrics snapshot stored in `ranger_metrics` */
export interface MetricsSnapshot {
  tvlEurc: number;
  currentApyPct: number;
  driftApyPct: number;
  kaminoApyPct: number;
  saveApyPct: number;
  spreadBps: number;
  rebalances24h: number;
  compounds24h: number;
  healthScore: number;
  timestamp: number;
}

/** Bot persistent state in `ranger_state/{key}` */
export interface RebalancerState {
  lastRebalanceAt: number | null;
  totalRebalances: number;
  circuitBreakerTripped: boolean;
  circuitBreakerTrippedAt: number | null;
  circuitBreakerReason: string | null;
  peakTvlEurc: number;
  updatedAt: number;
}
