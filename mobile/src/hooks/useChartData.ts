import { useMemo } from 'react';
import { EURC_DECIMALS } from '../lib/constants';

export interface ChartDataPoint {
  value: number;
  label?: string;
}

// Seeded random for deterministic data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function usePortfolioSparkline(days = 7, baseValue = 60000) {
  return useMemo(() => {
    const data: ChartDataPoint[] = [];
    let value = baseValue;

    for (let i = days; i >= 0; i--) {
      const dailyReturn = (seededRandom(i * 7 + 42) - 0.35) * 0.012;
      value = value * (1 + dailyReturn);
      const date = new Date(Date.now() - i * 86400_000);
      data.push({
        value: Math.round(value * 100) / 100,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    return data;
  }, [days, baseValue]);
}

export function useEarningsProjection(amount: number, apy: number) {
  return useMemo(() => {
    if (amount <= 0) return [];

    const months = [
      { label: '1M', multiplier: 1 / 12 },
      { label: '3M', multiplier: 3 / 12 },
      { label: '6M', multiplier: 6 / 12 },
      { label: '1Y', multiplier: 1 },
      { label: '2Y', multiplier: 2 },
    ];

    return months.map(({ label, multiplier }) => ({
      value: Math.round(amount * (apy / 100) * multiplier * 100) / 100,
      label,
    }));
  }, [amount, apy]);
}

export function useRewardsTimeline(days = 30, totalRewards = 456) {
  return useMemo(() => {
    const data: ChartDataPoint[] = [];
    let cumulative = 0;
    const dailyRate = totalRewards / days;

    for (let i = days; i >= 0; i--) {
      const variance = seededRandom(i * 29 + 13) * 0.4 + 0.8;
      cumulative += dailyRate * variance;
      const date = new Date(Date.now() - i * 86400_000);
      data.push({
        value: Math.round(cumulative * 100) / 100,
        label: i % 7 === 0
          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '',
      });
    }
    return data;
  }, [days, totalRewards]);
}
