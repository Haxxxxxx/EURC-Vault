/**
 * Unit tests for the risk engine.
 *
 * Pure functions only — no mocking required.
 * Covers: computeAllocation, computeDrawdown, hasConcentrationViolation, assessRisk.
 *
 * Config defaults used (from ranger/bot/config.ts):
 *   CIRCUIT_BREAKER_DRAWDOWN_PCT = 0.02  (2%)
 *   MAX_ALLOCATION_PCT           = 0.70  (70%)
 *   MIN_ALLOCATION_PCT           = 0.10  (10%)
 *   MAX_UTILIZATION              = 0.85  (85%)
 */
import { describe, it, expect } from 'vitest';

import {
  computeAllocation,
  computeDrawdown,
  assessRisk,
  hasConcentrationViolation,
} from '../bot/engine/risk.js';
import type { VaultState, ProtocolRate } from '../bot/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 100 000 EURC expressed in 6-decimal atoms */
const TOTAL = 100_000 * 1_000_000;

function makeVaultState(overrides: Partial<VaultState> = {}): VaultState {
  return {
    totalAssets:      TOTAL,
    totalShares:      TOTAL,
    driftAllocation:  50_000 * 1_000_000, // 50%
    kaminoAllocation: 30_000 * 1_000_000, // 30%
    saveAllocation:   15_000 * 1_000_000, // 15%
    idleBalance:       5_000 * 1_000_000, // 5%
    peakTvl:          TOTAL,
    lastRebalanceAt:  null,
    lastCompoundAt:   null,
    ...overrides,
  };
}

function makeRate(
  protocol: ProtocolRate['protocol'],
  overrides: Partial<ProtocolRate> = {},
): ProtocolRate {
  return {
    protocol,
    apy: 0.08,
    apyBps: 800,
    utilization: 0.60,
    availableLiquidity: 10_000_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: false,
    ...overrides,
  };
}

const LOW_UTIL_RATES = {
  drift:  makeRate('drift'),
  kamino: makeRate('kamino'),
  save:   makeRate('save'),
};

// ─── computeAllocation ───────────────────────────────────────────────────────

describe('computeAllocation', () => {
  it('returns correct fractions for a healthy vault', () => {
    const result = computeAllocation(makeVaultState());

    expect(result.drift).toBeCloseTo(0.50, 5);
    expect(result.kamino).toBeCloseTo(0.30, 5);
    expect(result.save).toBeCloseTo(0.15, 5);
    expect(result.idle).toBeCloseTo(0.05, 5);
    // Fractions must sum to 1
    expect(result.drift + result.kamino + result.save + result.idle).toBeCloseTo(1.0, 5);
  });

  it('returns idle=1 when totalAssets is zero', () => {
    const result = computeAllocation(
      makeVaultState({
        totalAssets:      0,
        driftAllocation:  0,
        kaminoAllocation: 0,
        saveAllocation:   0,
        idleBalance:      0,
      }),
    );

    expect(result).toEqual({ drift: 0, kamino: 0, save: 0, idle: 1 });
  });

  it('handles fully idle vault', () => {
    const result = computeAllocation(
      makeVaultState({
        driftAllocation:  0,
        kaminoAllocation: 0,
        saveAllocation:   0,
        idleBalance:      TOTAL,
      }),
    );

    expect(result.drift).toBe(0);
    expect(result.kamino).toBe(0);
    expect(result.save).toBe(0);
    expect(result.idle).toBe(1);
  });
});

// ─── computeDrawdown ─────────────────────────────────────────────────────────

describe('computeDrawdown', () => {
  it('returns 0 when peakTvl is zero', () => {
    expect(computeDrawdown(makeVaultState({ peakTvl: 0 }))).toBe(0);
  });

  it('returns 0 when totalAssets equals peakTvl (no drawdown)', () => {
    expect(computeDrawdown(makeVaultState())).toBe(0);
  });

  it('returns 0 when totalAssets exceeds peakTvl (growth)', () => {
    // Can happen briefly before peakTvl is updated
    const result = computeDrawdown(
      makeVaultState({ totalAssets: TOTAL + 1_000_000 }),
    );
    expect(result).toBe(0);
  });

  it('computes 1% drawdown correctly', () => {
    const result = computeDrawdown(
      makeVaultState({ totalAssets: 99_000 * 1_000_000 }),
    );
    expect(result).toBeCloseTo(0.01, 5);
  });

  it('computes 2% drawdown correctly', () => {
    const result = computeDrawdown(
      makeVaultState({ totalAssets: 98_000 * 1_000_000 }),
    );
    expect(result).toBeCloseTo(0.02, 5);
  });
});

// ─── hasConcentrationViolation ───────────────────────────────────────────────

describe('hasConcentrationViolation', () => {
  it('returns false for a well-balanced allocation', () => {
    expect(
      hasConcentrationViolation({ drift: 0.50, kamino: 0.30, save: 0.15, idle: 0.05 }),
    ).toBe(false);
  });

  it('returns false when all active protocols are at exactly 10% (minimum)', () => {
    expect(
      hasConcentrationViolation({ drift: 0.10, kamino: 0.10, save: 0.10, idle: 0.70 }),
    ).toBe(false);
  });

  it('returns false when a protocol is at exactly 70% (maximum)', () => {
    expect(
      hasConcentrationViolation({ drift: 0.70, kamino: 0.15, save: 0.10, idle: 0.05 }),
    ).toBe(false);
  });

  it('returns true when a protocol exceeds 70%', () => {
    expect(
      hasConcentrationViolation({ drift: 0.71, kamino: 0.14, save: 0.10, idle: 0.05 }),
    ).toBe(true);
  });

  it('returns true when an active protocol is below 10%', () => {
    // save has 5% allocation — below minimum
    expect(
      hasConcentrationViolation({ drift: 0.65, kamino: 0.25, save: 0.05, idle: 0.05 }),
    ).toBe(true);
  });

  it('returns false when protocols are all zero (fully idle)', () => {
    // Zero allocation doesn't trigger the minimum check
    expect(
      hasConcentrationViolation({ drift: 0, kamino: 0, save: 0, idle: 1 }),
    ).toBe(false);
  });
});

// ─── assessRisk ──────────────────────────────────────────────────────────────

describe('assessRisk', () => {
  it('returns GREEN for a healthy vault', () => {
    const result = assessRisk(makeVaultState(), LOW_UTIL_RATES, false);

    expect(result.level).toBe('GREEN');
    expect(result.drawdownPercent).toBe(0);
    expect(result.circuitBreakerTripped).toBe(false);
    expect(result.utilizationWarnings).toHaveLength(0);
    expect(result.healthScore).toBeGreaterThanOrEqual(80);
    expect(result.mostConcentratedProtocol).toBe('drift'); // 50% is highest
    expect(result.highestConcentration).toBeCloseTo(0.50, 5);
  });

  it('returns YELLOW when drawdown reaches 1% (half the 2% circuit breaker)', () => {
    const state = makeVaultState({ totalAssets: 99_000 * 1_000_000 });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.level).toBe('YELLOW');
    expect(result.drawdownPercent).toBeCloseTo(0.01, 4);
  });

  it('returns YELLOW when any protocol utilization exceeds 85%', () => {
    const highUtilRates = {
      ...LOW_UTIL_RATES,
      drift: makeRate('drift', { utilization: 0.90 }), // above MAX_UTILIZATION
    };
    const result = assessRisk(makeVaultState(), highUtilRates, false);

    expect(result.level).toBe('YELLOW');
    expect(result.utilizationWarnings.length).toBeGreaterThan(0);
    expect(result.utilizationWarnings[0]).toContain('drift');
  });

  it('returns YELLOW when most concentrated protocol is just above 70%', () => {
    // 71% in drift — crosses MAX_ALLOCATION_PCT
    const state = makeVaultState({
      driftAllocation:  71_000 * 1_000_000,
      kaminoAllocation: 15_000 * 1_000_000,
      saveAllocation:    9_000 * 1_000_000,
      idleBalance:       5_000 * 1_000_000,
    });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.level).toBe('YELLOW');
    expect(result.highestConcentration).toBeGreaterThan(0.70);
    expect(result.mostConcentratedProtocol).toBe('drift');
  });

  it('returns RED when drawdown reaches 1.5% (75% of circuit breaker threshold)', () => {
    const state = makeVaultState({ totalAssets: 98_500 * 1_000_000 });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.level).toBe('RED');
    expect(result.drawdownPercent).toBeCloseTo(0.015, 4);
  });

  it('returns RED when most concentrated protocol exceeds 75% (MAX_ALLOCATION + 5%)', () => {
    // 76% in drift — crosses MAX_ALLOCATION_PCT + 0.05 = 0.75
    const state = makeVaultState({
      driftAllocation:  76_000 * 1_000_000,
      kaminoAllocation: 10_000 * 1_000_000,
      saveAllocation:    9_000 * 1_000_000,
      idleBalance:       5_000 * 1_000_000,
    });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.level).toBe('RED');
    expect(result.highestConcentration).toBeGreaterThan(0.75);
  });

  it('returns EMERGENCY immediately when circuit breaker is tripped', () => {
    const result = assessRisk(makeVaultState(), LOW_UTIL_RATES, true);

    expect(result.level).toBe('EMERGENCY');
    expect(result.circuitBreakerTripped).toBe(true);
  });

  it('returns EMERGENCY when drawdown reaches 2% (circuit breaker threshold)', () => {
    const state = makeVaultState({ totalAssets: 98_000 * 1_000_000 });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.level).toBe('EMERGENCY');
    expect(result.drawdownPercent).toBeCloseTo(0.02, 4);
  });

  it('reports multiple utilization warnings when several protocols exceed threshold', () => {
    const allHighUtil = {
      drift:  makeRate('drift',  { utilization: 0.92 }),
      kamino: makeRate('kamino', { utilization: 0.88 }),
      save:   makeRate('save',   { utilization: 0.86 }),
    };
    const result = assessRisk(makeVaultState(), allHighUtil, false);

    expect(result.utilizationWarnings).toHaveLength(3);
  });

  it('sets mostConcentratedProtocol to null when all allocations are zero', () => {
    const state = makeVaultState({
      totalAssets:      0,
      driftAllocation:  0,
      kaminoAllocation: 0,
      saveAllocation:   0,
      idleBalance:      0,
    });
    const result = assessRisk(state, LOW_UTIL_RATES, false);

    expect(result.mostConcentratedProtocol).toBeNull();
    expect(result.highestConcentration).toBe(0);
  });
});
