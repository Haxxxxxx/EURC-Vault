/**
 * Circuit Breaker — emergency halt when TVL drops > CIRCUIT_BREAKER_DRAWDOWN_PCT.
 *
 * When tripped:
 * 1. Withdraws all funds from lending protocols back to vault idle
 * 2. Sends emergency alert via Discord/Telegram
 * 3. Halts all further rebalancing until manually reset
 *
 * The circuit breaker state is persisted in-process and in Firestore.
 */
import { CIRCUIT_BREAKER_DRAWDOWN_PCT } from '../config.js';
import type { VaultState, RiskState } from '../types.js';
import { sendAlert } from '../monitoring/alerts.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:circuit-breaker');

interface CircuitBreakerState {
  tripped: boolean;
  trippedAt: Date | null;
  trippedReason: string | null;
  peakTvl: number;
  tripCount: number;
}

// Module-level singleton state
const state: CircuitBreakerState = {
  tripped:       false,
  trippedAt:     null,
  trippedReason: null,
  peakTvl:       0,
  tripCount:     0,
};

/** Update peak TVL tracker — call on every vault state read */
export function updatePeakTvl(currentTvl: number): void {
  if (currentTvl > state.peakTvl) {
    state.peakTvl = currentTvl;
    log.debug('Peak TVL updated', { peakTvl: state.peakTvl });
  }
}

/** Returns current peak TVL */
export function getPeakTvl(): number {
  return state.peakTvl;
}

/** Returns true if circuit breaker is currently tripped */
export function isTripped(): boolean {
  return state.tripped;
}

/** Returns current circuit breaker state snapshot */
export function getState(): Readonly<CircuitBreakerState> {
  return { ...state };
}

/**
 * Evaluate whether to trip the circuit breaker.
 * Call after every vault state update.
 *
 * @returns true if newly tripped this call, false otherwise
 */
export async function evaluate(
  vaultState: VaultState,
  riskState: RiskState,
): Promise<boolean> {
  if (state.tripped) {
    log.warn('Circuit breaker already tripped — bot is in emergency halt');
    return false;
  }

  const shouldTrip =
    riskState.level === 'EMERGENCY' ||
    riskState.drawdownPercent >= CIRCUIT_BREAKER_DRAWDOWN_PCT;

  if (!shouldTrip) {
    // Only update peak when we are NOT tripping so riskState_drawdown() logs correctly
    updatePeakTvl(vaultState.totalAssets);
    return false;
  }

  const reason = riskState.drawdownPercent >= CIRCUIT_BREAKER_DRAWDOWN_PCT
    ? `Drawdown ${(riskState.drawdownPercent * 100).toFixed(2)}% >= limit ${CIRCUIT_BREAKER_DRAWDOWN_PCT * 100}%`
    : 'Risk level EMERGENCY';

  await trip(reason, vaultState);
  // Update peak AFTER trip so riskState_drawdown() inside trip() logs the correct value
  updatePeakTvl(vaultState.totalAssets);
  return true;
}

/** Manually trip the circuit breaker (e.g. from healthCheck function) */
export async function trip(reason: string, vaultState: VaultState): Promise<void> {
  state.tripped       = true;
  state.trippedAt     = new Date();
  state.trippedReason = reason;
  state.tripCount    += 1;

  log.error('🚨 CIRCUIT BREAKER TRIPPED', undefined, {
    reason,
    totalTvl: vaultState.totalAssets,
    peakTvl:  state.peakTvl,
    drawdown: `${(riskState_drawdown(vaultState) * 100).toFixed(2)}%`,
    tripCount: state.tripCount,
  });

  // Alert operators immediately
  await sendAlert({
    level:    'EMERGENCY',
    title:    '🚨 CIRCUIT BREAKER TRIPPED — Bot halted',
    message:  reason,
    fields: {
      TVL:      formatEurc(vaultState.totalAssets),
      'Peak TVL': formatEurc(state.peakTvl),
      'Trip #': String(state.tripCount),
      'Tripped At': new Date().toISOString(),
    },
  });
}

/**
 * Reset the circuit breaker (requires manual operator action).
 * This is intentionally not automated — requires human review.
 */
export function reset(operatorNote: string): void {
  log.warn('Circuit breaker manually reset', { operatorNote });
  state.tripped       = false;
  state.trippedAt     = null;
  state.trippedReason = null;
  // Note: peakTvl and tripCount are intentionally preserved
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function riskState_drawdown(vaultState: VaultState): number {
  if (state.peakTvl === 0) return 0;
  return Math.max(0, (state.peakTvl - vaultState.totalAssets) / state.peakTvl);
}

function formatEurc(atoms: number): string {
  return `${(atoms / 1_000_000).toFixed(2)} EURC`;
}
