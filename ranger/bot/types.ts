/**
 * Shared types for the EURC Cross-Protocol Yield Optimizer
 */

export type ProtocolId = 'drift' | 'kamino' | 'save';

export interface ProtocolRate {
  protocol: ProtocolId;
  /** APY as a decimal, e.g. 0.08 = 8% */
  apy: number;
  /** APY in basis points, e.g. 800 = 8% */
  apyBps: number;
  /** Protocol utilization ratio, 0–1 */
  utilization: number;
  /** Available liquidity in EURC atoms (6 decimals) */
  availableLiquidity: number;
  fetchedAt: Date;
  /** True if rate is older than RATE_STALENESS_MS */
  isStale: boolean;
}

export interface VaultState {
  /** Total assets under management in EURC atoms */
  totalAssets: number;
  /** Total vault shares outstanding */
  totalShares: number;
  /** EURC atoms deployed to Drift */
  driftAllocation: number;
  /** EURC atoms deployed to Kamino */
  kaminoAllocation: number;
  /** EURC atoms deployed to Save */
  saveAllocation: number;
  /** Undeployed EURC atoms sitting idle */
  idleBalance: number;
  /** Peak TVL seen (for drawdown calculation) */
  peakTvl: number;
  lastRebalanceAt: Date | null;
  lastCompoundAt: Date | null;
  /** True when state was fetched from on-chain data; false for simulated/mock */
  isLive?: boolean;
}

/** Per-protocol allocation expressed as fractions of TVL (must sum to 1) */
export interface StrategyAllocation {
  drift: number;
  kamino: number;
  save: number;
  idle: number;
}

export interface RebalanceDecision {
  shouldRebalance: boolean;
  reason: string;
  currentAllocation: StrategyAllocation;
  targetAllocation: StrategyAllocation;
  /** Spread between best and worst protocol in bps */
  spreadBps: number;
  /** Expected annualized gain from rebalancing */
  estimatedGainAnnualized: number;
  highestRateProtocol: ProtocolId;
  lowestRateProtocol: ProtocolId;
}

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'EMERGENCY';

export interface RiskState {
  level: RiskLevel;
  /** Current drawdown from peak TVL as a fraction, e.g. 0.015 = 1.5% */
  drawdownPercent: number;
  /** Fraction of TVL in the most concentrated protocol */
  highestConcentration: number;
  mostConcentratedProtocol: ProtocolId | null;
  utilizationWarnings: string[];
  circuitBreakerTripped: boolean;
  /** Composite health score 0–100 */
  healthScore: number;
}

export interface RebalanceEvent {
  id: string;
  fromProtocol: ProtocolId | 'idle';
  toProtocol: ProtocolId | 'idle';
  /** Amount moved in EURC atoms */
  amountEurc: number;
  /** Spread that triggered the rebalance in bps */
  spreadBps: number;
  txSignature: string | null;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface MetricsSnapshot {
  /** Total TVL in EURC atoms */
  totalTvl: number;
  /** Annualized APY as decimal, e.g. 0.12 = 12% */
  currentApy: number;
  driftAllocation: number;
  kaminoAllocation: number;
  saveAllocation: number;
  idleAllocation: number;
  drawdownPercent: number;
  healthScore: number;
  rebalanceCount24h: number;
  compoundCount24h: number;
  timestamp: Date;
}

export interface CompoundEvent {
  id: string;
  protocol: ProtocolId;
  /** Accrued interest harvested in EURC atoms */
  harvestedAmount: number;
  /** Protocol re-deposited into */
  redeployedTo: ProtocolId;
  txSignature: string | null;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface BotConfig {
  rebalanceMinSpreadBps: number;
  maxAllocationPct: number;
  minAllocationPct: number;
  idleReservePct: number;
  rebalanceCooldownMs: number;
  compoundMinAmount: number;
  circuitBreakerDrawdownPct: number;
  rateFetchIntervalMs: number;
  rebalanceIntervalMs: number;
  compoundIntervalMs: number;
  healthCheckIntervalMs: number;
}
