/**
 * Kamino Finance (kLend) EURC supply rate fetcher.
 *
 * Uses @kamino-finance/klend-sdk to read the EURC reserve state and
 * compute the current deposit APY.
 *
 * Devnet fallback: returns a realistic mock when EURC reserve is unavailable.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import {
  KaminoMarket,
  type KaminoReserve,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  PROGRAM_ID as KAMINO_LENDING_PROGRAM_ID,
} from '@kamino-finance/klend-sdk';

import {
  SOLANA_RPC_URL,
  RATE_STALENESS_MS,
  ACTIVE_MINT,
} from '../config.js';
import type { ProtocolRate } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('rates:kamino');

// Main Kamino kLend market (mainnet)
const KAMINO_MAIN_MARKET = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';

async function reserveToRate(
  reserve: KaminoReserve,
  connection: Connection,
): Promise<ProtocolRate> {
  const currentSlot = await connection.getSlot();
  const supplyApy   = reserve.totalSupplyAPY(currentSlot);
  const utilization = reserve.calculateUtilizationRatio();
  // getLiquidityAvailableAmount returns a Decimal-like object
  const availableLiquidity = Number(reserve.getLiquidityAvailableAmount().toString());

  return {
    protocol: 'kamino',
    apy: supplyApy,
    apyBps: Math.round(supplyApy * 10_000),
    utilization,
    availableLiquidity,
    fetchedAt: new Date(),
    isStale: false,
  };
}

function mockKaminoRate(): ProtocolRate {
  log.warn('Using mock Kamino rate — EURC reserve unavailable on this cluster');
  const apy = 0.065 + Math.random() * 0.025;
  return {
    protocol: 'kamino',
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.68,
    availableLiquidity: 800_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: false,
  };
}

export async function fetchKaminoRate(connection?: Connection): Promise<ProtocolRate> {
  const conn = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');

  try {
    const marketPubkey = new PublicKey(KAMINO_MAIN_MARKET);

    // KaminoMarket.load(connection, address, recentSlotDurationMs, programId?, setupLocal?, withReserves?)
    const market = await KaminoMarket.load(
      conn,
      marketPubkey,
      DEFAULT_RECENT_SLOT_DURATION_MS,
      new PublicKey(KAMINO_LENDING_PROGRAM_ID),
      false,
      true,
    );

    if (!market) {
      log.warn('Failed to load Kamino market');
      return mockKaminoRate();
    }

    const mintPubkey = new PublicKey(ACTIVE_MINT);
    const reserve = market.getReserveByMint(mintPubkey);

    if (!reserve) {
      log.warn('EURC reserve not found in Kamino market', { mint: ACTIVE_MINT });
      return mockKaminoRate();
    }

    const rate = await reserveToRate(reserve, conn);
    log.info('Kamino rate fetched', {
      apy: `${(rate.apy * 100).toFixed(2)}%`,
      utilization: rate.utilization.toFixed(2),
    });
    return rate;
  } catch (err) {
    log.error('Failed to fetch Kamino rate', err);
    return mockKaminoRate();
  }
}

export function isKaminoRateStale(rate: ProtocolRate): boolean {
  return Date.now() - rate.fetchedAt.getTime() > RATE_STALENESS_MS;
}
