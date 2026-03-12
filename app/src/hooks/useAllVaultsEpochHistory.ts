'use client';

import { useState, useEffect } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { VAULT_REGISTRY, EURC_DECIMALS } from '@/lib/constants';
import { calculateApy } from '@eurc-vault/sdk';
import type { ApyDataPoint, TvlDataPoint } from './useChartData';

/**
 * Aggregates epoch history across all vaults.
 * Used for the dashboard aggregate charts.
 */
export function useAllVaultsEpochHistory(maxEpochs = 12) {
  const readOnlyClient = useReadOnlyClient();
  const [aggregateApy, setAggregateApy] = useState<ApyDataPoint[]>([]);
  const [aggregateTvl, setAggregateTvl] = useState<TvlDataPoint[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!readOnlyClient) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchAll() {
      try {
        setLoading(true);

        // Fetch epoch histories for all vaults in parallel
        const allHistories = await Promise.allSettled(
          VAULT_REGISTRY.map(async (entry) => {
            try {
              return await readOnlyClient!.getEpochHistory(entry.onChainId);
            } catch {
              return [];
            }
          }),
        );

        if (controller.signal.aborted) return;

        const histories = allHistories.map((r) =>
          r.status === 'fulfilled' ? r.value : [],
        );

        // Check if any vault has data
        const hasData = histories.some((h) => h.length > 0);
        setIsLive(hasData);

        if (!hasData) {
          setAggregateApy([]);
          setAggregateTvl([]);
          setLoading(false);
          return;
        }

        // Build epoch-indexed aggregates
        // Use the first vault with data to determine epoch range
        const allSnapshots = histories.flat();
        if (allSnapshots.length === 0) {
          setLoading(false);
          return;
        }

        // Group by epoch number
        const byEpoch = new Map<number, {
          totalEurcInVault: number;
          exchangeRateSum: number;
          stakers: number;
          count: number;
          startTime: number;
          endTime: number;
        }>();
        for (const snap of allSnapshots) {
          const epoch = snap.epochNumber.toNumber();
          const existing = byEpoch.get(epoch) || {
            totalEurcInVault: 0, exchangeRateSum: 0, stakers: 0, count: 0, startTime: Infinity, endTime: 0,
          };
          existing.totalEurcInVault += snap.totalEurcInVault.toNumber();
          existing.exchangeRateSum += snap.exchangeRate.toNumber();
          existing.stakers += snap.stakerCount.toNumber();
          existing.count++;
          existing.startTime = Math.min(existing.startTime, snap.startTime.toNumber());
          existing.endTime = Math.max(existing.endTime, snap.endTime.toNumber());
          byEpoch.set(epoch, existing);
        }

        // Sort by epoch, take last N
        const sortedEpochs = Array.from(byEpoch.entries())
          .sort((a, b) => a[0] - b[0])
          .slice(-maxEpochs);

        const apyData: ApyDataPoint[] = sortedEpochs.map(([epoch, data], idx) => {
          let apy = 0;
          if (idx > 0) {
            const prev = sortedEpochs[idx - 1][1];
            const prevAvgRate = prev.exchangeRateSum / prev.count;
            const curAvgRate = data.exchangeRateSum / data.count;
            const duration = data.endTime - prev.endTime;
            if (duration > 0) {
              apy = calculateApy(prevAvgRate, curAvgRate, duration);
            }
          }
          return { epoch, apy: Math.round(apy * 100) / 100 };
        });

        const tvlData: TvlDataPoint[] = sortedEpochs.map(([, data]) => ({
          date: new Date(data.endTime * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          tvl: data.totalEurcInVault / Math.pow(10, EURC_DECIMALS),
          stakers: data.stakers,
        }));

        setAggregateApy(apyData);
        setAggregateTvl(tvlData);
      } catch {
        setAggregateApy([]);
        setAggregateTvl([]);
        setIsLive(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchAll();
    return () => controller.abort();
  }, [readOnlyClient, maxEpochs]);

  return { aggregateApy, aggregateTvl, isLive, loading };
}
