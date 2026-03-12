import { useMemo } from 'react';
import { EURC_DECIMALS } from '@/lib/constants';

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

export interface ApyDataPoint {
  epoch: number;
  apy: number;
}

export interface TvlDataPoint {
  date: string;
  tvl: number;
  stakers: number;
}

export interface VolumeDataPoint {
  week: string;
  deposits: number;
  withdrawals: number;
  rewards: number;
}

export interface AllocationDataPoint {
  name: string;
  value: number;
  color: string;
}

// Seeded random for deterministic data across renders
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function usePortfolioHistory(days = 30, baseValue = 60000) {
  return useMemo(() => {
    const data: PortfolioSnapshot[] = [];
    let value = baseValue;
    const now = Date.now();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 86400_000);
      const dailyReturn = (seededRandom(i * 7 + 42) - 0.35) * 0.015;
      value = value * (1 + dailyReturn);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(value * 100) / 100,
      });
    }
    return data;
  }, [days, baseValue]);
}

export function useApyHistory(epochs = 12, baseApy = 4.5) {
  return useMemo(() => {
    const data: ApyDataPoint[] = [];
    const currentEpoch = 24;

    for (let i = 0; i < epochs; i++) {
      const epoch = currentEpoch - epochs + i + 1;
      const variance = (seededRandom(epoch * 13 + 7) - 0.5) * 1.5;
      data.push({
        epoch,
        apy: Math.max(0.5, baseApy + variance),
      });
    }
    return data;
  }, [epochs, baseApy]);
}

export function useTvlHistory(days = 90, baseTvl = 4_000_000) {
  return useMemo(() => {
    const data: TvlDataPoint[] = [];
    let tvl = baseTvl * 0.4;
    let stakers = 80;
    const now = Date.now();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 86400_000);
      const growth = seededRandom(i * 3 + 19) * 0.025;
      tvl = tvl * (1 + growth);
      stakers = Math.floor(stakers + seededRandom(i * 5 + 31) * 3);

      if (i % 3 === 0) {
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          tvl: Math.round(tvl),
          stakers,
        });
      }
    }
    return data;
  }, [days, baseTvl]);
}

export function useTransactionVolume(weeks = 12) {
  return useMemo(() => {
    const data: VolumeDataPoint[] = [];
    const now = Date.now();

    for (let i = weeks; i >= 0; i--) {
      const date = new Date(now - i * 7 * 86400_000);
      const weekLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const depositsBase = 50000 + seededRandom(i * 11 + 3) * 200000;
      const withdrawalsBase = 20000 + seededRandom(i * 17 + 5) * 80000;
      const rewardsBase = 5000 + seededRandom(i * 23 + 9) * 15000;

      data.push({
        week: weekLabel,
        deposits: Math.round(depositsBase),
        withdrawals: Math.round(withdrawalsBase),
        rewards: Math.round(rewardsBase),
      });
    }
    return data;
  }, [weeks]);
}

const ALLOCATION_COLORS = ['#003399', '#0044CC', '#10B981', '#F59E0B'];

export function useVaultAllocation(
  stakes: Array<{ vaultId: string; stakedAmount: number }>,
  vaultNames: Record<string, string>
) {
  return useMemo(() => {
    const total = stakes.reduce((sum, s) => sum + s.stakedAmount, 0);
    if (total === 0) return [];

    return stakes.map((s, i) => ({
      name: vaultNames[s.vaultId] || s.vaultId,
      value: s.stakedAmount / Math.pow(10, EURC_DECIMALS),
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
    }));
  }, [stakes, vaultNames]);
}

export function useRewardsTimeline(days = 30, totalRewards = 456) {
  return useMemo(() => {
    const data: PortfolioSnapshot[] = [];
    let cumulative = 0;
    const dailyRate = totalRewards / days;
    const now = Date.now();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 86400_000);
      const variance = seededRandom(i * 29 + 13) * 0.4 + 0.8;
      cumulative += dailyRate * variance;
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(cumulative * 100) / 100,
      });
    }
    return data;
  }, [days, totalRewards]);
}

// Re-export real data hooks — consumers can use these and fall back to mock above
export { useRealApyHistory, useRealTvlHistory } from './useRealChartData';
export { useAllVaultsEpochHistory } from './useAllVaultsEpochHistory';
export { useEpochTimelineData } from './useEpochTimelineData';
