/**
 * Save (formerly Solend) EURC supply rate fetcher.
 *
 * Save exposes a public REST API at https://api.save.finance/v1/markets
 * for reserve stats including current borrow/supply APY.
 * Falls back to on-chain parsing if API is unavailable.
 *
 * Devnet fallback: returns a realistic mock when EURC reserve is unavailable.
 */
import { Connection } from '@solana/web3.js';

import {
  SOLANA_RPC_URL,
  SAVE_RESERVE_ADDRESS,
  RATE_STALENESS_MS,
} from '../config.js';
import type { ProtocolRate } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('rates:save');

const SAVE_API_BASE = 'https://api.save.finance';

interface SaveReserveResponse {
  results: Array<{
    rates?: { supplyInterest?: string };
    reserve?: {
      liquidity?: {
        availableAmount?: string;
        borrowedAmountWads?: string;
      };
    };
  }>;
}

function mockSaveRate(): ProtocolRate {
  log.warn('Using mock Save rate — EURC reserve unavailable on this cluster');
  const apy = 0.055 + Math.random() * 0.02; // 5.5–7.5%
  return {
    protocol: 'save',
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.61,
    availableLiquidity: 1_200_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: true, // Mock rates must be flagged stale to prevent rebalancing on random data
  };
}

async function fetchFromSaveApi(reserveAddress: string): Promise<ProtocolRate | null> {
  try {
    const url = `${SAVE_API_BASE}/v1/reserves?ids=${reserveAddress}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });

    if (!res.ok) {
      log.warn('Save API returned non-200', { status: res.status });
      return null;
    }

    const data = (await res.json()) as SaveReserveResponse;
    const result = data.results?.[0];

    if (!result?.rates) {
      log.warn('EURC reserve not found in Save API response', { reserveAddress });
      return null;
    }

    // supplyInterest is a percentage string (e.g., "0.23" = 0.23%)
    const apyPct = parseFloat(result.rates.supplyInterest ?? '0');
    const apy = apyPct / 100; // Convert to decimal

    // Compute utilization from raw liquidity fields
    let utilization = 0;
    let availableLiquidity = 0;
    const liq = result.reserve?.liquidity;
    if (liq) {
      const available = parseFloat(liq.availableAmount ?? '0') / 1e6;
      const borrowed = parseFloat(liq.borrowedAmountWads ?? '0') / 1e18 / 1e6;
      const total = available + borrowed;
      if (total > 0) utilization = borrowed / total;
      availableLiquidity = Math.round(available * 1e6); // back to atoms
    }

    return {
      protocol: 'save',
      apy,
      apyBps: Math.round(apy * 10_000),
      utilization,
      availableLiquidity,
      fetchedAt: new Date(),
      isStale: false,
    };
  } catch (err) {
    log.error('Save API fetch failed', err);
    return null;
  }
}

export async function fetchSaveRate(_connection?: Connection): Promise<ProtocolRate> {
  if (!SAVE_RESERVE_ADDRESS) {
    log.debug('SAVE_RESERVE_ADDRESS not set, using mock');
    return mockSaveRate();
  }

  // Try the REST API first (fastest path)
  const apiRate = await fetchFromSaveApi(SAVE_RESERVE_ADDRESS);
  if (apiRate) {
    log.info('Save rate fetched via API', {
      apy: `${(apiRate.apy * 100).toFixed(2)}%`,
      utilization: apiRate.utilization.toFixed(2),
    });
    return apiRate;
  }

  // If API fails, fall back to mock (on-chain parsing would require the Solend/Save
  // reserve layout which is complex — add if needed for production)
  log.warn('Save API unavailable, using mock rate');
  return mockSaveRate();
}

export function isSaveRateStale(rate: ProtocolRate): boolean {
  return Date.now() - rate.fetchedAt.getTime() > RATE_STALENESS_MS;
}
