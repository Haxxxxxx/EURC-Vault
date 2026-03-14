export type ProtocolId = 'drift' | 'kamino' | 'save';
export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'EMERGENCY';

export interface RangerRate {
  protocol: ProtocolId;
  apy: number;
  apyBps: number;
  utilization: number;
  isStale: boolean;
  fetchedAt: number;
}

export interface RangerRatesDoc {
  drift: RangerRate;
  kamino: RangerRate;
  save: RangerRate;
  best: ProtocolId;
  worst: ProtocolId;
  spreadBps: number;
  fetchedAt: number;
}

export interface RangerMetrics {
  tvlEurc: number;
  currentApyPct: number;
  driftApyPct: number;
  kaminoApyPct: number;
  saveApyPct: number;
  spreadBps: number;
  rebalances24h: number;
  compounds24h: number;
  healthScore: number;
  ratesStale: boolean;
  circuitBreakerTripped: boolean;
  timestamp: number;
}

export type ActivityEventType = 'rebalance' | 'compound' | 'rate_alert' | 'health_check' | 'deposit' | 'withdraw';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  protocol?: ProtocolId;
  /** EURC amount involved (UI amount, not atoms) */
  amountEurc?: number;
  /** APY improvement in bps */
  gainBps?: number;
  txSig?: string;
  timestamp: number;
}

export interface RebalanceRecord {
  decision: 'REBALANCE' | 'SKIP';
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
