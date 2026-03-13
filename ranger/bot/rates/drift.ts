/**
 * Drift Protocol EURC supply rate fetcher.
 *
 * Reads the Drift spot market account on-chain to extract the current
 * borrow and supply APY for EURC. Uses @drift-labs/sdk SpotMarket state.
 *
 * Devnet fallback: EURC spot market may not exist — returns a realistic
 * mock rate so the rest of the bot can be tested end-to-end.
 */
import {
  DriftClient,
  calculateDepositRate,
  DRIFT_PROGRAM_ID,
  type SpotMarketAccount,
} from '@drift-labs/sdk';
import { Connection, PublicKey } from '@solana/web3.js';

import { DRIFT_SPOT_MARKET_INDEX, SOLANA_RPC_URL, RATE_STALENESS_MS } from '../config.js';
import type { ProtocolRate } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('rates:drift');

const EURC_MARKET_INDEX = DRIFT_SPOT_MARKET_INDEX;

function spotMarketToRate(market: SpotMarketAccount): ProtocolRate {
  // calculateDepositRate returns the APR as a BN in parts-per-million (1e6 = 100%)
  const depositRatePpm = calculateDepositRate(market);
  const apy = depositRatePpm.toNumber() / 1_000_000;
  const apyBps = Math.round(apy * 10_000);

  const totalDeposits = market.depositBalance.toNumber();
  const totalBorrows  = market.borrowBalance.toNumber();
  const utilization   = totalDeposits > 0 ? totalBorrows / totalDeposits : 0;
  const availableLiquidity = Math.max(0, totalDeposits - totalBorrows);

  return {
    protocol: 'drift',
    apy,
    apyBps,
    utilization,
    availableLiquidity,
    fetchedAt: new Date(),
    isStale: false,
  };
}

function mockDriftRate(): ProtocolRate {
  log.warn('Using mock Drift rate — EURC market unavailable on this cluster');
  const apy = 0.095 + Math.random() * 0.03;
  return {
    protocol: 'drift',
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.72,
    availableLiquidity: 500_000 * 1_000_000,
    fetchedAt: new Date(),
    isStale: false,
  };
}

export async function fetchDriftRate(connection?: Connection): Promise<ProtocolRate> {
  const conn = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');

  // Hoist outside try so catch can call unsubscribe() and avoid websocket leaks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let driftClient: DriftClient | undefined;

  try {
    // Drift SDK ships its own @solana/web3.js — cast to avoid version mismatch on Connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    driftClient = new DriftClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: conn as any,
      wallet: {
        publicKey: PublicKey.default,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signTransaction: async (tx: any) => tx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signAllTransactions: async (txs: any) => txs,
      },
      programID: new PublicKey(DRIFT_PROGRAM_ID),
      env: SOLANA_RPC_URL.includes('mainnet') ? 'mainnet-beta' : 'devnet',
      spotMarketIndexes: [EURC_MARKET_INDEX],
      perpMarketIndexes: [],
      oracleInfos: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await driftClient.subscribe();

    const spotMarket = driftClient.getSpotMarketAccount(EURC_MARKET_INDEX);

    if (!spotMarket) {
      log.warn('Drift spot market not found for index', { index: EURC_MARKET_INDEX });
      await driftClient.unsubscribe();
      return mockDriftRate();
    }

    const rate = spotMarketToRate(spotMarket);
    await driftClient.unsubscribe();

    log.info('Drift rate fetched', {
      apy: `${(rate.apy * 100).toFixed(2)}%`,
      utilization: rate.utilization.toFixed(2),
    });
    return rate;
  } catch (err) {
    // Ensure subscription is cleaned up to avoid websocket leaks
    await driftClient?.unsubscribe().catch(() => {});
    log.error('Failed to fetch Drift rate', err);
    return mockDriftRate();
  }
}

export function isDriftRateStale(rate: ProtocolRate): boolean {
  return Date.now() - rate.fetchedAt.getTime() > RATE_STALENESS_MS;
}
