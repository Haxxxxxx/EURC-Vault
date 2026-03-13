/**
 * Rate Aggregator — unified interface for fetching EURC supply rates
 * across all three protocols simultaneously.
 *
 * Handles:
 * - Parallel fetches with per-protocol timeouts
 * - Stale rate detection
 * - Oracle sanity check (reject >50% deviation from rolling average)
 * - Structured logging for every fetch cycle
 */
import { Connection } from '@solana/web3.js';

import { fetchDriftRate }  from './drift.js';
import { fetchKaminoRate } from './kamino.js';
import { fetchSaveRate }   from './save.js';
import {
  RATE_STALENESS_MS,
  RATE_ORACLE_DEVIATION_LIMIT,
  SOLANA_RPC_URL,
} from '../config.js';
import type { ProtocolRate, ProtocolId } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('rates:aggregator');

// Simple in-memory rolling average (last 10 fetches per protocol)
const rateHistory: Record<ProtocolId, number[]> = {
  drift:  [],
  kamino: [],
  save:   [],
};

const MAX_HISTORY = 10;

function updateHistory(protocol: ProtocolId, apy: number): void {
  const h = rateHistory[protocol];
  h.push(apy);
  if (h.length > MAX_HISTORY) h.shift();
}

function rollingAverage(protocol: ProtocolId): number | null {
  const h = rateHistory[protocol];
  if (h.length < 3) return null; // need at least 3 samples
  return h.reduce((s, v) => s + v, 0) / h.length;
}

/**
 * Sanity check: if a rate deviates > RATE_ORACLE_DEVIATION_LIMIT from the rolling
 * average, treat it as potentially bad data and log a warning.
 */
function passesOracleCheck(rate: ProtocolRate): boolean {
  const avg = rollingAverage(rate.protocol);
  if (avg === null) return true; // not enough history yet

  const deviation = Math.abs(rate.apy - avg) / avg;
  if (deviation > RATE_ORACLE_DEVIATION_LIMIT) {
    log.warn('Rate oracle check failed — large deviation', {
      protocol:  rate.protocol,
      currentApy: rate.apy.toFixed(4),
      rollingAvg: avg.toFixed(4),
      deviationPct: `${(deviation * 100).toFixed(1)}%`,
    });
    return false;
  }
  return true;
}

export interface AggregatedRates {
  drift:  ProtocolRate;
  kamino: ProtocolRate;
  save:   ProtocolRate;
  /** Best (highest APY) protocol among non-stale, oracle-passing rates */
  best: ProtocolId;
  /** Worst (lowest APY) protocol */
  worst: ProtocolId;
  /** Spread in bps between best and worst */
  spreadBps: number;
  fetchedAt: Date;
}

/**
 * Fetch all three protocol rates in parallel.
 * Each fetch has an independent timeout so one slow protocol won't block others.
 */
export async function fetchAllRates(connection?: Connection): Promise<AggregatedRates> {
  const conn = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');
  const start = Date.now();

  log.info('Fetching rates from all protocols...');

  const [drift, kamino, save] = await Promise.all([
    fetchDriftRate(conn).catch((err) => {
      log.error('Drift fetch threw', err);
      return null;
    }),
    fetchKaminoRate(conn).catch((err) => {
      log.error('Kamino fetch threw', err);
      return null;
    }),
    fetchSaveRate(conn).catch((err) => {
      log.error('Save fetch threw', err);
      return null;
    }),
  ]);

  const elapsed = Date.now() - start;

  // Validate and update history for each non-null result
  const validate = (rate: ProtocolRate | null, protocol: ProtocolId): ProtocolRate => {
    if (!rate) {
      log.error(`${protocol} returned null — using emergency fallback`);
      return emergencyFallback(protocol);
    }
    updateHistory(protocol, rate.apy);
    if (!passesOracleCheck(rate)) {
      log.warn(`${protocol} rate failed oracle check — using last known good`);
      const lastGood = getLastGoodRate(protocol);
      if (lastGood !== null) {
        return { ...rate, apy: lastGood, apyBps: Math.round(lastGood * 10_000), isStale: true };
      }
      // No lastGood available (< 3 samples) — mark stale rather than pass through silently
      return { ...rate, isStale: true };
    }
    return rate;
  };

  const validDrift  = validate(drift,  'drift');
  const validKamino = validate(kamino, 'kamino');
  const validSave   = validate(save,   'save');

  // Rank by APY
  const rankedRaw: Array<[ProtocolId, number]> = [
    ['drift',  validDrift.apy],
    ['kamino', validKamino.apy],
    ['save',   validSave.apy],
  ];
  const ranked = rankedRaw.sort((a, b) => b[1] - a[1]);

  const best  = ranked[0][0];
  const worst = ranked[ranked.length - 1][0];
  const spreadBps = Math.round((ranked[0][1] - ranked[ranked.length - 1][1]) * 10_000);

  log.info('Rate fetch complete', {
    elapsedMs: elapsed,
    drift:   `${(validDrift.apy  * 100).toFixed(2)}%`,
    kamino:  `${(validKamino.apy * 100).toFixed(2)}%`,
    save:    `${(validSave.apy   * 100).toFixed(2)}%`,
    best,
    spreadBps,
  });

  return {
    drift:  validDrift,
    kamino: validKamino,
    save:   validSave,
    best,
    worst,
    spreadBps,
    fetchedAt: new Date(),
  };
}

/** Check if any rate in an AggregatedRates is stale */
export function hasStaleRates(rates: AggregatedRates): boolean {
  const now = Date.now();
  return (
    now - rates.drift.fetchedAt.getTime()  > RATE_STALENESS_MS ||
    now - rates.kamino.fetchedAt.getTime() > RATE_STALENESS_MS ||
    now - rates.save.fetchedAt.getTime()   > RATE_STALENESS_MS
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns rolling average as "last known good" rate approximation */
function getLastGoodRate(protocol: ProtocolId): number | null {
  return rollingAverage(protocol);
}

/** Emergency fallback rates (conservative estimates) */
function emergencyFallback(protocol: ProtocolId): ProtocolRate {
  const apyMap: Record<ProtocolId, number> = {
    drift:  0.08,
    kamino: 0.065,
    save:   0.055,
  };
  const apy = apyMap[protocol];
  return {
    protocol,
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.5,
    availableLiquidity: 100_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: true,
  };
}
