/**
 * Unit tests for the rebalancing engine.
 *
 * Pure functions only — no mocking required.
 * Covers: computeTargetAllocation, evaluateRebalance (spread/cooldown/empty-vault gates).
 *
 * Config defaults used (from ranger/bot/config.ts):
 *   REBALANCE_MIN_SPREAD_BPS     = 50
 *   MAX_ALLOCATION_PCT           = 0.70  (70%)
 *   MIN_ALLOCATION_PCT           = 0.10  (10%)
 *   IDLE_RESERVE_PCT             = 0.05  (5%)
 *   REBALANCE_COOLDOWN_MS        = 1_800_000  (30 min)
 *   MAX_REBALANCE_PCT_PER_CYCLE  = 0.30  (30%)
 *   MAX_UTILIZATION              = 0.85  (85%)
 */
import { describe, it, expect } from 'vitest';

import { computeTargetAllocation, evaluateRebalance } from '../bot/engine/rebalancer.js';
import type { AggregatedRates } from '../bot/rates/aggregator.js';
import type { VaultState, ProtocolRate, ProtocolId } from '../bot/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOTAL = 100_000 * 1_000_000; // 100k EURC atoms

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

function makeProtocolRate(
  protocol: ProtocolId,
  apy: number,
  overrides: Partial<ProtocolRate> = {},
): ProtocolRate {
  return {
    protocol,
    apy,
    apyBps:             Math.round(apy * 10_000),
    utilization:        0.60,
    availableLiquidity: 10_000_000 * 1_000_000,
    fetchedAt:          new Date(),
    isStale:            false,
    ...overrides,
  };
}

/**
 * Build an AggregatedRates object from three APY values.
 * Derives best/worst/spreadBps automatically.
 */
function makeRates(
  driftApy: number,
  kaminoApy: number,
  saveApy: number,
  rateOverrides: {
    drift?: Partial<ProtocolRate>;
    kamino?: Partial<ProtocolRate>;
    save?: Partial<ProtocolRate>;
  } = {},
): AggregatedRates {
  const entries: Array<[ProtocolId, number]> = [
    ['drift',  driftApy],
    ['kamino', kaminoApy],
    ['save',   saveApy],
  ];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const best  = sorted[0][0];
  const worst = sorted[sorted.length - 1][0];
  const spreadBps = Math.round((sorted[0][1] - sorted[sorted.length - 1][1]) * 10_000);

  return {
    drift:  makeProtocolRate('drift',  driftApy,  rateOverrides.drift  ?? {}),
    kamino: makeProtocolRate('kamino', kaminoApy, rateOverrides.kamino ?? {}),
    save:   makeProtocolRate('save',   saveApy,   rateOverrides.save   ?? {}),
    best,
    worst,
    spreadBps,
    fetchedAt: new Date(),
  };
}

// Standard rates: drift 8.5% > kamino 7.2% > save 6.1% — spread 240 bps
const WIDE_SPREAD_RATES = makeRates(0.085, 0.072, 0.061);

// Narrow spread: drift 7.3%, kamino 7.2%, save 7.1% — spread 20 bps
const NARROW_SPREAD_RATES = makeRates(0.073, 0.072, 0.071);

// ─── computeTargetAllocation ─────────────────────────────────────────────────

describe('computeTargetAllocation', () => {
  it('concentrates MAX_ALLOCATION_PCT on the best protocol', () => {
    const currentAlloc = { drift: 0.50, kamino: 0.30, save: 0.15, idle: 0.05 };
    const target = computeTargetAllocation(WIDE_SPREAD_RATES, currentAlloc);

    // Drift is best (8.5%) — should receive max allocation (70%)
    expect(target.drift).toBeCloseTo(0.70, 5);
    expect(target.kamino).toBeCloseTo(0.10, 5);
    expect(target.save).toBeCloseTo(0.10, 5);
  });

  it('allocations sum to 1.0', () => {
    const currentAlloc = { drift: 0.50, kamino: 0.30, save: 0.15, idle: 0.05 };
    const target = computeTargetAllocation(WIDE_SPREAD_RATES, currentAlloc);

    const sum = target.drift + target.kamino + target.save + target.idle;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('assigns kamino as best when it has the highest APY', () => {
    const kaminoBest = makeRates(0.072, 0.115, 0.063); // kamino highest
    const target = computeTargetAllocation(kaminoBest, { drift: 0, kamino: 0, save: 0, idle: 1 });

    expect(target.kamino).toBeCloseTo(0.70, 5);
    expect(target.drift).toBeCloseTo(0.10, 5);
    expect(target.save).toBeCloseTo(0.10, 5);
  });

  it('excludes protocols with utilization > MAX_UTILIZATION (85%)', () => {
    const highUtilRates = makeRates(0.085, 0.072, 0.061, {
      kamino: { utilization: 0.90 }, // above threshold — should be excluded
    });
    const target = computeTargetAllocation(highUtilRates, { drift: 0.50, kamino: 0.30, save: 0.15, idle: 0.05 });

    // Kamino excluded — only drift and save are active
    expect(target.kamino).toBe(0);
    expect(target.drift).toBeCloseTo(0.70, 5); // drift best among active
    expect(target.save).toBeCloseTo(0.10, 5);  // save gets minimum
  });

  it('routes everything to idle when all protocols exceed MAX_UTILIZATION', () => {
    const allHighUtil = makeRates(0.085, 0.072, 0.061, {
      drift:  { utilization: 0.92 },
      kamino: { utilization: 0.91 },
      save:   { utilization: 0.90 },
    });
    const target = computeTargetAllocation(allHighUtil, { drift: 0.50, kamino: 0.30, save: 0.15, idle: 0.05 });

    expect(target).toEqual({ drift: 0, kamino: 0, save: 0, idle: 1 });
  });

  it('returns raw optimal target (before per-cycle cap) when starting from all-idle', () => {
    // computeTargetAllocation returns the full optimal target.
    // The per-cycle move cap is applied later by evaluateRebalance.
    const target = computeTargetAllocation(WIDE_SPREAD_RATES, { drift: 0, kamino: 0, save: 0, idle: 1 });

    expect(target.drift).toBeCloseTo(0.70, 5);
    expect(target.kamino).toBeCloseTo(0.10, 5);
    expect(target.save).toBeCloseTo(0.10, 5);
    const sum = target.drift + target.kamino + target.save + target.idle;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ─── evaluateRebalance ───────────────────────────────────────────────────────

describe('evaluateRebalance', () => {
  it('returns shouldRebalance: false when spread is below minimum (50 bps)', () => {
    const result = evaluateRebalance(makeVaultState(), NARROW_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(false);
    expect(result.reason).toMatch(/spread/i);
    expect(result.spreadBps).toBe(NARROW_SPREAD_RATES.spreadBps);
    // targetAllocation should equal currentAllocation when skipping
    expect(result.targetAllocation).toEqual(result.currentAllocation);
  });

  it('returns shouldRebalance: false when cooldown is still active (< 30 min)', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1_000);
    const result = evaluateRebalance(makeVaultState(), WIDE_SPREAD_RATES, tenMinutesAgo);

    expect(result.shouldRebalance).toBe(false);
    expect(result.reason).toMatch(/cooldown/i);
  });

  it('returns shouldRebalance: false when vault has no assets', () => {
    const emptyVault = makeVaultState({
      totalAssets:      0,
      driftAllocation:  0,
      kaminoAllocation: 0,
      saveAllocation:   0,
      idleBalance:      0,
    });
    const result = evaluateRebalance(emptyVault, WIDE_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(false);
    expect(result.reason).toMatch(/no assets/i);
  });

  it('returns shouldRebalance: true when spread exceeds threshold and no cooldown', () => {
    const result = evaluateRebalance(makeVaultState(), WIDE_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(true);
    expect(result.spreadBps).toBe(240);
    expect(result.highestRateProtocol).toBe('drift');
    expect(result.lowestRateProtocol).toBe('save');
  });

  it('rebalances after cooldown has elapsed (> 30 min ago)', () => {
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1_000);
    const result = evaluateRebalance(makeVaultState(), WIDE_SPREAD_RATES, fortyMinutesAgo);

    expect(result.shouldRebalance).toBe(true);
  });

  it('target allocation concentrates on best protocol when rebalancing', () => {
    const result = evaluateRebalance(makeVaultState(), WIDE_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(true);
    // Drift is best — should receive maximum allocation
    expect(result.targetAllocation.drift).toBeCloseTo(0.70, 5);
    expect(result.targetAllocation.kamino).toBeCloseTo(0.10, 5);
    expect(result.targetAllocation.save).toBeCloseTo(0.10, 5);
  });

  it('estimated gain is positive when moving capital to higher-rate protocol', () => {
    // Start: all in save (lowest rate 6.1%). Best is drift at 8.5%
    const vaultAllInSave = makeVaultState({
      driftAllocation:  0,
      kaminoAllocation: 0,
      saveAllocation:   TOTAL,
      idleBalance:      0,
    });
    const result = evaluateRebalance(vaultAllInSave, WIDE_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(true);
    expect(result.estimatedGainAnnualized).toBeGreaterThan(0);
  });

  it('returns zero estimated gain when skipping rebalance', () => {
    const result = evaluateRebalance(makeVaultState(), NARROW_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(false);
    expect(result.estimatedGainAnnualized).toBe(0);
  });

  it('target allocation sums to 1.0 when rebalancing', () => {
    const result = evaluateRebalance(makeVaultState(), WIDE_SPREAD_RATES, null);
    const { targetAllocation: t } = result;

    expect(t.drift + t.kamino + t.save + t.idle).toBeCloseTo(1.0, 5);
  });

  it('exactly-50-bps spread triggers a rebalance (boundary case)', () => {
    // Spread of exactly MIN_SPREAD threshold
    const exactSpreadRates = makeRates(0.08, 0.075, 0.075); // spread = 50 bps
    const result = evaluateRebalance(makeVaultState(), exactSpreadRates, null);

    expect(result.spreadBps).toBe(50);
    expect(result.shouldRebalance).toBe(true);
  });

  it('49-bps spread does not trigger rebalance (just below threshold)', () => {
    const justBelowRates = makeRates(0.0799, 0.075, 0.075); // ~49 bps
    const result = evaluateRebalance(makeVaultState(), justBelowRates, null);

    expect(result.spreadBps).toBeLessThan(50);
    expect(result.shouldRebalance).toBe(false);
  });

  it('caps total capital moved to MAX_REBALANCE_PCT_PER_CYCLE (30%) per cycle', () => {
    // All-idle vault needs to move 90%+ to reach optimal — cap kicks in
    const allIdle = makeVaultState({
      driftAllocation:  0,
      kaminoAllocation: 0,
      saveAllocation:   0,
      idleBalance:      TOTAL,
    });
    const result = evaluateRebalance(allIdle, WIDE_SPREAD_RATES, null);

    expect(result.shouldRebalance).toBe(true);
    const { targetAllocation: t } = result;
    // Total moved out of idle ≤ 30%
    const deployed = t.drift + t.kamino + t.save;
    expect(deployed).toBeLessThanOrEqual(0.30 + 1e-9);
    // Still sums to 1
    expect(t.drift + t.kamino + t.save + t.idle).toBeCloseTo(1.0, 5);
  });
});
