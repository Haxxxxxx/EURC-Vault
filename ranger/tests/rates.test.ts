/**
 * Unit tests for the rate aggregator.
 *
 * Protocol fetchers are mocked so no network calls are made.
 * Tests cover: ranking, emergency fallback, stale detection, oracle sanity check.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks (must be declared before imports) ───────────────────────────

vi.mock('../bot/rates/drift.js', () => ({ fetchDriftRate: vi.fn() }));
vi.mock('../bot/rates/kamino.js', () => ({ fetchKaminoRate: vi.fn() }));
vi.mock('../bot/rates/save.js', () => ({ fetchSaveRate: vi.fn() }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { fetchAllRates, hasStaleRates, type AggregatedRates } from '../bot/rates/aggregator.js';
import { fetchDriftRate } from '../bot/rates/drift.js';
import { fetchKaminoRate } from '../bot/rates/kamino.js';
import { fetchSaveRate } from '../bot/rates/save.js';
import type { ProtocolRate } from '../bot/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRate(
  protocol: ProtocolRate['protocol'],
  apy: number,
  overrides: Partial<ProtocolRate> = {},
): ProtocolRate {
  return {
    protocol,
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.6,
    availableLiquidity: 10_000_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: false,
    ...overrides,
  };
}

// ─── fetchAllRates ────────────────────────────────────────────────────────────

describe('fetchAllRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct best/worst/spreadBps when all protocols succeed', async () => {
    vi.mocked(fetchDriftRate).mockResolvedValue(makeRate('drift',  0.085)); // 8.5%
    vi.mocked(fetchKaminoRate).mockResolvedValue(makeRate('kamino', 0.072)); // 7.2%
    vi.mocked(fetchSaveRate).mockResolvedValue(makeRate('save',   0.061)); // 6.1%

    const result = await fetchAllRates();

    expect(result.best).toBe('drift');
    expect(result.worst).toBe('save');
    // spread = (0.085 - 0.061) * 10_000 = 240 bps
    expect(result.spreadBps).toBe(240);
    expect(result.drift.apy).toBe(0.085);
    expect(result.kamino.apy).toBe(0.072);
    expect(result.save.apy).toBe(0.061);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it('kamino is best when it has the highest APY', async () => {
    vi.mocked(fetchDriftRate).mockResolvedValue(makeRate('drift',  0.072));
    vi.mocked(fetchKaminoRate).mockResolvedValue(makeRate('kamino', 0.112)); // highest
    vi.mocked(fetchSaveRate).mockResolvedValue(makeRate('save',   0.068));

    const result = await fetchAllRates();

    expect(result.best).toBe('kamino');
    expect(result.worst).toBe('save');
    expect(result.spreadBps).toBe(Math.round((0.112 - 0.068) * 10_000)); // 440 bps
  });

  it('uses emergency fallback when drift throws', async () => {
    vi.mocked(fetchDriftRate).mockRejectedValue(new Error('Connection timeout'));
    vi.mocked(fetchKaminoRate).mockResolvedValue(makeRate('kamino', 0.072));
    vi.mocked(fetchSaveRate).mockResolvedValue(makeRate('save',   0.061));

    const result = await fetchAllRates();

    expect(result.drift.isStale).toBe(true);
    expect(result.drift.apy).toBe(0.08);      // emergency fallback = 8%
    expect(result.kamino.isStale).toBe(false);
    expect(result.save.isStale).toBe(false);
  });

  it('uses emergency fallback for all protocols when all throw', async () => {
    vi.mocked(fetchDriftRate).mockRejectedValue(new Error('Network error'));
    vi.mocked(fetchKaminoRate).mockRejectedValue(new Error('Network error'));
    vi.mocked(fetchSaveRate).mockRejectedValue(new Error('Network error'));

    const result = await fetchAllRates();

    expect(result.drift.isStale).toBe(true);
    expect(result.kamino.isStale).toBe(true);
    expect(result.save.isStale).toBe(true);
    // Emergency fallback rates: drift 8%, kamino 6.5%, save 5.5%
    expect(result.drift.apy).toBe(0.08);
    expect(result.kamino.apy).toBe(0.065);
    expect(result.save.apy).toBe(0.055);
    // Ranking should still work on fallback values
    expect(result.best).toBe('drift');
    expect(result.worst).toBe('save');
  });

  it('falls back to last known good when rate deviates > 50% from rolling average', async () => {
    // Seed rateHistory with 3 stable drift readings at 8.5%
    const stableKamino = makeRate('kamino', 0.072);
    const stableSave   = makeRate('save',   0.061);

    vi.mocked(fetchDriftRate).mockResolvedValue(makeRate('drift', 0.085));
    vi.mocked(fetchKaminoRate).mockResolvedValue(stableKamino);
    vi.mocked(fetchSaveRate).mockResolvedValue(stableSave);

    await fetchAllRates();
    await fetchAllRates();
    await fetchAllRates(); // history now has 3 samples → oracle check active

    // Inject a wildly deviant drift rate: 18% (>50% deviation from ~8.5% avg)
    vi.mocked(fetchDriftRate).mockResolvedValue(makeRate('drift', 0.18));
    const result = await fetchAllRates();

    // Oracle check fails → falls back to rolling average and marks stale.
    // The deviant rate (0.18) is added to history before the check runs, so the
    // fallback value is the new rolling average — which is less than the deviant
    // rate but may not equal exactly 0.085 depending on accumulated history.
    expect(result.drift.isStale).toBe(true);
    expect(result.drift.apy).not.toBe(0.18);       // deviant rate was rejected
    expect(result.drift.apy).toBeLessThan(0.12);   // clearly below the 18% spike
  });
});

// ─── hasStaleRates ────────────────────────────────────────────────────────────

describe('hasStaleRates', () => {
  function makeAggregated(
    driftTs: Date,
    kaminoTs: Date,
    saveTs: Date,
  ): AggregatedRates {
    return {
      drift:  makeRate('drift',  0.085, { fetchedAt: driftTs }),
      kamino: makeRate('kamino', 0.072, { fetchedAt: kaminoTs }),
      save:   makeRate('save',   0.061, { fetchedAt: saveTs }),
      best:  'drift',
      worst: 'save',
      spreadBps: 240,
      fetchedAt: new Date(),
    };
  }

  it('returns false when all rates are fresh', () => {
    const now = new Date();
    expect(hasStaleRates(makeAggregated(now, now, now))).toBe(false);
  });

  it('returns true when drift rate is older than 10 minutes', () => {
    const now     = new Date();
    const staleTs = new Date(Date.now() - 11 * 60 * 1_000); // 11 min ago
    expect(hasStaleRates(makeAggregated(staleTs, now, now))).toBe(true);
  });

  it('returns true when kamino rate is stale', () => {
    const now     = new Date();
    const staleTs = new Date(Date.now() - 11 * 60 * 1_000);
    expect(hasStaleRates(makeAggregated(now, staleTs, now))).toBe(true);
  });

  it('returns true when save rate is stale', () => {
    const now     = new Date();
    const staleTs = new Date(Date.now() - 11 * 60 * 1_000);
    expect(hasStaleRates(makeAggregated(now, now, staleTs))).toBe(true);
  });

  it('returns false when rates are exactly at the staleness boundary minus 1ms', () => {
    // 9 min 59 sec old — not yet stale
    const justFresh = new Date(Date.now() - (10 * 60 * 1_000 - 1));
    const now = new Date();
    expect(hasStaleRates(makeAggregated(justFresh, now, now))).toBe(false);
  });
});
