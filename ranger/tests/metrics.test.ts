/**
 * Unit tests for the metrics / TWR APY calculator.
 *
 * The module uses module-level state (twrPeriods, eventLog) so each test
 * gets a fresh module via vi.resetModules() + dynamic import.
 *
 * Time is controlled via vi.useFakeTimers() / vi.setSystemTime() so we can
 * simulate realistic multi-day periods without actually waiting.
 *
 * TWR formula:
 *   TWR  = ∏ (1 + sub_period_return)
 *   APY  = TWR ^ (365.25_days / total_elapsed_days) − 1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Types for dynamic imports ────────────────────────────────────────────────

type MetricsMod = typeof import('../bot/monitoring/metrics.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOTAL = 100_000 * 1_000_000; // 100k EURC atoms
const DAY_MS = 24 * 60 * 60 * 1_000;

/** Re-import a fresh module instance after vi.resetModules() */
async function freshMetrics(): Promise<MetricsMod> {
  return import('../bot/monitoring/metrics.js');
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── calculateApy ─────────────────────────────────────────────────────────────

describe('calculateApy', () => {
  it('returns 0 when no periods have been recorded', async () => {
    const { calculateApy } = await freshMetrics();
    expect(calculateApy()).toBe(0);
  });

  it('returns 0 after a single recordTwrPeriod call (only sets baseline, no period created)', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordTwrPeriod(TOTAL); // first call: sets lastSnapshotTvl, creates no period yet

    expect(calculateApy()).toBe(0);
  });

  it('returns 0 after exactly one period recorded (needs ≥ 2)', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordTwrPeriod(TOTAL);

    vi.setSystemTime(new Date('2026-01-31T00:00:00Z')); // 30 days later
    recordTwrPeriod(TOTAL * 1.0058); // slight growth

    // twrPeriods.length === 1 → calculateApy returns 0
    expect(calculateApy()).toBe(0);
  });

  it('returns 0 when TVL has not changed (zero sub-period return)', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(t0);
    recordTwrPeriod(TOTAL);

    vi.setSystemTime(new Date(t0.getTime() + 30 * DAY_MS));
    recordTwrPeriod(TOTAL); // same TVL

    vi.setSystemTime(new Date(t0.getTime() + 60 * DAY_MS));
    recordTwrPeriod(TOTAL); // same TVL again

    expect(calculateApy()).toBe(0);
  });

  it('returns 0 (clamped) when TVL declines', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(t0);
    recordTwrPeriod(TOTAL);

    vi.setSystemTime(new Date(t0.getTime() + 30 * DAY_MS));
    recordTwrPeriod(TOTAL * 0.99); // 1% loss

    vi.setSystemTime(new Date(t0.getTime() + 60 * DAY_MS));
    recordTwrPeriod(TOTAL * 0.98); // another loss

    expect(calculateApy()).toBe(0); // clamped via Math.max(0, apy)
  });

  it('computes ~7% APY from two 2-day periods of linear 7% growth', async () => {
    // IMPORTANT: the 7-day rolling window prunes periods with startTime < (now - 7 days).
    // Use 2-day gaps so all periods stay within the window at test time (4 days total span).
    //
    // Expected math:
    //   rate_2d = 0.07 * 2/365.25 = 0.0003834
    //   twr     = (1 + rate_2d)^2 = 1.0007669
    //   elapsed = 4 days → yearsElapsed = 4/365.25 = 0.010951
    //   apy     = 1.0007669^(1/0.010951) − 1 ≈ 7.25%
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const rate2d = 0.07 * 2 / 365.25;
    const t0 = new Date('2026-01-01T00:00:00Z');

    vi.setSystemTime(t0);
    recordTwrPeriod(TOTAL);

    vi.setSystemTime(new Date(t0.getTime() + 2 * DAY_MS)); // T + 2 days
    const tvl1 = Math.round(TOTAL * (1 + rate2d));
    recordTwrPeriod(tvl1);

    vi.setSystemTime(new Date(t0.getTime() + 4 * DAY_MS)); // T + 4 days
    const tvl2 = Math.round(tvl1 * (1 + rate2d));
    recordTwrPeriod(tvl2);

    const apy = calculateApy();

    expect(apy).toBeGreaterThan(0.065); // > 6.5%
    expect(apy).toBeLessThan(0.080);    // < 8.0%
  });

  it('computes ~12% APY from two 2-day periods at 12% growth rate', async () => {
    // Same 7-day window constraint — use 2-day gaps.
    //
    // Expected math:
    //   rate_2d = 0.12 * 2/365.25 = 0.0006571
    //   twr     = (1 + rate_2d)^2 = 1.0013146
    //   elapsed = 4 days → yearsElapsed = 0.010951
    //   apy     = 1.0013146^91.32 − 1 ≈ 12.7%
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const rate2d = 0.12 * 2 / 365.25;
    const t0 = new Date('2026-01-01T00:00:00Z');
    let tvl = TOTAL;

    vi.setSystemTime(t0);
    recordTwrPeriod(tvl);

    vi.setSystemTime(new Date(t0.getTime() + 2 * DAY_MS));
    tvl = Math.round(tvl * (1 + rate2d));
    recordTwrPeriod(tvl);

    vi.setSystemTime(new Date(t0.getTime() + 4 * DAY_MS));
    tvl = Math.round(tvl * (1 + rate2d));
    recordTwrPeriod(tvl);

    const apy = calculateApy();

    expect(apy).toBeGreaterThan(0.10); // > 10%
    expect(apy).toBeLessThan(0.14);    // < 14%
  });

  it('handles a period with zero start value (skips the period)', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(t0);
    recordTwrPeriod(0); // zero TVL at start (skipped in loop due to `if startValue === 0`)

    vi.setSystemTime(new Date(t0.getTime() + 30 * DAY_MS));
    recordTwrPeriod(TOTAL); // vault fills up

    vi.setSystemTime(new Date(t0.getTime() + 60 * DAY_MS));
    recordTwrPeriod(Math.round(TOTAL * 1.006));

    // Period with startValue=0 is skipped. Two periods recorded but the zero-start
    // one contributes nothing, so calculateApy proceeds on the valid period.
    // With only 1 valid period but twrPeriods.length === 2, it attempts calculation.
    const apy = calculateApy();
    expect(typeof apy).toBe('number');
    expect(isNaN(apy)).toBe(false);
    expect(isFinite(apy)).toBe(true);
  });

  it('prunes periods older than 7 days from the rolling window', async () => {
    const { calculateApy, recordTwrPeriod } = await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    const rate3d = 0.07 * 3 / 365.25;
    let tvl = TOTAL;

    vi.setSystemTime(t0);
    recordTwrPeriod(tvl);

    // Record 5 periods at 3-day intervals (spanning 15 days total)
    for (let i = 1; i <= 5; i++) {
      tvl = Math.round(tvl * (1 + rate3d));
      vi.setSystemTime(new Date(t0.getTime() + i * 3 * DAY_MS));
      recordTwrPeriod(tvl);
    }

    // Now jump 8 days forward and record a new period —
    // the earliest periods (older than 7 days from the latest) should be pruned.
    const latestTime = t0.getTime() + 5 * 3 * DAY_MS;
    vi.setSystemTime(new Date(latestTime + 8 * DAY_MS));
    tvl = Math.round(tvl * (1 + 0.07 * 8 / 365.25));
    recordTwrPeriod(tvl);

    // APY should still be computable (some periods survived pruning)
    const apy = calculateApy();
    expect(typeof apy).toBe('number');
    expect(isNaN(apy)).toBe(false);
  });
});

// ─── Event counting ───────────────────────────────────────────────────────────

describe('recordRebalanceEvent / recordCompoundEvent', () => {
  it('counts rebalance events correctly', async () => {
    const { recordRebalanceEvent, recordTwrPeriod, calculateApy, generateSnapshot } =
      await freshMetrics();

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    // We test the counts via generateSnapshot which calls countEvents internally.
    // Import the types we need for generateSnapshot.
    const { default: logger } = await import('../bot/monitoring/logger.js');
    void logger; // suppress unused warning

    // Directly test by recording and then reading snapshot counts.
    // We'll build a minimal snapshot scenario.
    recordRebalanceEvent();
    recordRebalanceEvent();
    recordRebalanceEvent();

    // Build a minimal vault state + rates to call generateSnapshot
    const vaultState = {
      totalAssets: TOTAL,
      totalShares: TOTAL,
      driftAllocation:  50_000 * 1_000_000,
      kaminoAllocation: 30_000 * 1_000_000,
      saveAllocation:   15_000 * 1_000_000,
      idleBalance:       5_000 * 1_000_000,
      peakTvl: TOTAL,
      lastRebalanceAt: null,
      lastCompoundAt: null,
    };

    const makeRate = (protocol: 'drift' | 'kamino' | 'save') => ({
      protocol,
      apy: 0.08,
      apyBps: 800,
      utilization: 0.6,
      availableLiquidity: 1_000_000 * 1_000_000,
      fetchedAt: new Date(),
      isStale: false,
    });

    const rates = {
      drift:    makeRate('drift'),
      kamino:   makeRate('kamino'),
      save:     makeRate('save'),
      best:     'drift'  as const,
      worst:    'save'   as const,
      spreadBps: 200,
      fetchedAt: new Date(),
    };

    // Seed 2 TWR periods so generateSnapshot → calculateApy() can run
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordTwrPeriod(TOTAL);
    vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));
    recordTwrPeriod(Math.round(TOTAL * 1.0058));
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z'));

    const snapshot = generateSnapshot(vaultState, rates, false);

    expect(snapshot.rebalanceCount24h).toBe(3);
    expect(snapshot.compoundCount24h).toBe(0);
  });

  it('counts compound events separately from rebalance events', async () => {
    const { recordRebalanceEvent, recordCompoundEvent, recordTwrPeriod, generateSnapshot } =
      await freshMetrics();

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    recordRebalanceEvent();
    recordRebalanceEvent();
    recordCompoundEvent();
    recordCompoundEvent();
    recordCompoundEvent();

    const vaultState = {
      totalAssets: TOTAL, totalShares: TOTAL,
      driftAllocation: 50_000 * 1_000_000, kaminoAllocation: 30_000 * 1_000_000,
      saveAllocation: 15_000 * 1_000_000, idleBalance: 5_000 * 1_000_000,
      peakTvl: TOTAL, lastRebalanceAt: null, lastCompoundAt: null,
    };
    const makeRate = (p: 'drift' | 'kamino' | 'save') => ({
      protocol: p, apy: 0.08, apyBps: 800, utilization: 0.6,
      availableLiquidity: 1_000_000 * 1_000_000, fetchedAt: new Date(), isStale: false,
    });
    const rates = {
      drift: makeRate('drift'), kamino: makeRate('kamino'), save: makeRate('save'),
      best: 'drift' as const, worst: 'save' as const, spreadBps: 200, fetchedAt: new Date(),
    };

    recordTwrPeriod(TOTAL);
    vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));
    recordTwrPeriod(Math.round(TOTAL * 1.0058));
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z'));

    const snapshot = generateSnapshot(vaultState, rates, false);

    expect(snapshot.rebalanceCount24h).toBe(2);
    expect(snapshot.compoundCount24h).toBe(3);
  });

  it('prunes events older than 24 hours from the rolling window', async () => {
    const { recordRebalanceEvent, recordTwrPeriod, generateSnapshot } =
      await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(t0);

    // Record 3 events now
    recordRebalanceEvent();
    recordRebalanceEvent();
    recordRebalanceEvent();

    // Advance time past 24h
    vi.setSystemTime(new Date(t0.getTime() + 25 * DAY_MS / 24)); // 25 hours later

    // Record 1 new event — this call triggers pruning, removing the 3 old events
    recordRebalanceEvent();

    const vaultState = {
      totalAssets: TOTAL, totalShares: TOTAL,
      driftAllocation: 50_000 * 1_000_000, kaminoAllocation: 30_000 * 1_000_000,
      saveAllocation: 15_000 * 1_000_000, idleBalance: 5_000 * 1_000_000,
      peakTvl: TOTAL, lastRebalanceAt: null, lastCompoundAt: null,
    };
    const makeRate = (p: 'drift' | 'kamino' | 'save') => ({
      protocol: p, apy: 0.08, apyBps: 800, utilization: 0.6,
      availableLiquidity: 1_000_000 * 1_000_000, fetchedAt: new Date(), isStale: false,
    });
    const rates = {
      drift: makeRate('drift'), kamino: makeRate('kamino'), save: makeRate('save'),
      best: 'drift' as const, worst: 'save' as const, spreadBps: 200, fetchedAt: new Date(),
    };

    recordTwrPeriod(TOTAL);
    vi.setSystemTime(new Date(t0.getTime() + 26 * DAY_MS / 24));
    recordTwrPeriod(Math.round(TOTAL * 1.0058));
    vi.setSystemTime(new Date(t0.getTime() + 27 * DAY_MS / 24));

    const snapshot = generateSnapshot(vaultState, rates, false);

    // Only the 1 event recorded at +25h should count (3 old ones pruned)
    expect(snapshot.rebalanceCount24h).toBe(1);
  });
});

// ─── generateSnapshot ─────────────────────────────────────────────────────────

describe('generateSnapshot', () => {
  it('returns correct TVL and allocation fractions', async () => {
    const { recordTwrPeriod, generateSnapshot } = await freshMetrics();

    const t0 = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(t0);
    recordTwrPeriod(TOTAL);
    vi.setSystemTime(new Date(t0.getTime() + 30 * DAY_MS));
    recordTwrPeriod(Math.round(TOTAL * 1.0058));
    vi.setSystemTime(new Date(t0.getTime() + 60 * DAY_MS));

    const vaultState = {
      totalAssets: TOTAL, totalShares: TOTAL,
      driftAllocation:  50_000 * 1_000_000, // 50%
      kaminoAllocation: 30_000 * 1_000_000, // 30%
      saveAllocation:   15_000 * 1_000_000, // 15%
      idleBalance:       5_000 * 1_000_000, // 5%
      peakTvl: TOTAL, lastRebalanceAt: null, lastCompoundAt: null,
    };
    const makeRate = (p: 'drift' | 'kamino' | 'save') => ({
      protocol: p, apy: 0.08, apyBps: 800, utilization: 0.6,
      availableLiquidity: 1_000_000 * 1_000_000, fetchedAt: new Date(), isStale: false,
    });
    const rates = {
      drift: makeRate('drift'), kamino: makeRate('kamino'), save: makeRate('save'),
      best: 'drift' as const, worst: 'save' as const, spreadBps: 200, fetchedAt: new Date(),
    };

    const snapshot = generateSnapshot(vaultState, rates, false);

    expect(snapshot.totalTvl).toBe(TOTAL);
    expect(snapshot.driftAllocation).toBeCloseTo(0.50, 5);
    expect(snapshot.kaminoAllocation).toBeCloseTo(0.30, 5);
    expect(snapshot.saveAllocation).toBeCloseTo(0.15, 5);
    expect(snapshot.idleAllocation).toBeCloseTo(0.05, 5);
    expect(snapshot.timestamp).toBeInstanceOf(Date);
    expect(snapshot.currentApy).toBeGreaterThanOrEqual(0);
    expect(snapshot.healthScore).toBeGreaterThan(0);
  });
});
