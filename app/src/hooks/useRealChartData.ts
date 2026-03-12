'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { VAULT_REGISTRY, EURC_DECIMALS } from '@/lib/constants';
import { calculateApy } from '@eurc-vault/sdk';
import type { EpochSnapshot } from '@eurc-vault/sdk';
import type {
  ApyDataPoint,
  TvlDataPoint,
  PortfolioSnapshot,
} from './useChartData';

/**
 * Fetch real APY history from on-chain EpochSnapshot accounts.
 * Returns mock-compatible data format.
 */
export function useRealApyHistory(slug?: string, maxEpochs = 12) {
  const readOnlyClient = useReadOnlyClient();
  const [data, setData] = useState<ApyDataPoint[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!readOnlyClient || !slug) {
      setData([]);
      setLoading(false);
      return;
    }

    const entry = VAULT_REGISTRY.find((v) => v.slug === slug);
    if (!entry) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetch() {
      try {
        setLoading(true);
        const snapshots = await readOnlyClient!.getEpochHistory(entry!.onChainId);

        if (controller.signal.aborted) return;

        if (snapshots.length === 0) {
          setIsLive(false);
          setData([]);
          setLoading(false);
          return;
        }

        const recent = snapshots.slice(-maxEpochs);
        const apyData: ApyDataPoint[] = recent.map((snap, idx) => {
          let apy = 0;
          if (idx > 0) {
            const prev = recent[idx - 1];
            const duration = snap.endTime.toNumber() - prev.endTime.toNumber();
            if (duration > 0) {
              apy = calculateApy(
                prev.exchangeRate.toNumber(),
                snap.exchangeRate.toNumber(),
                duration,
              );
            }
          }

          return {
            epoch: snap.epochNumber.toNumber(),
            apy: Math.round(apy * 100) / 100,
          };
        });

        setData(apyData);
        setIsLive(true);
      } catch {
        setData([]);
        setIsLive(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetch();
    return () => controller.abort();
  }, [readOnlyClient, slug, maxEpochs]);

  return { data, isLive, loading };
}

/**
 * Fetch real TVL history from on-chain EpochSnapshot accounts.
 */
export function useRealTvlHistory(slug?: string, maxEpochs = 20) {
  const readOnlyClient = useReadOnlyClient();
  const [data, setData] = useState<TvlDataPoint[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!readOnlyClient || !slug) {
      setData([]);
      setLoading(false);
      return;
    }

    const entry = VAULT_REGISTRY.find((v) => v.slug === slug);
    if (!entry) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetch() {
      try {
        setLoading(true);
        const snapshots = await readOnlyClient!.getEpochHistory(entry!.onChainId);

        if (controller.signal.aborted) return;

        if (snapshots.length === 0) {
          setIsLive(false);
          setData([]);
          setLoading(false);
          return;
        }

        const recent = snapshots.slice(-maxEpochs);
        const tvlData: TvlDataPoint[] = recent.map((snap) => ({
          date: new Date(snap.endTime.toNumber() * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          tvl: snap.totalEurcInVault.toNumber() / Math.pow(10, EURC_DECIMALS),
          stakers: snap.stakerCount.toNumber(),
        }));

        setData(tvlData);
        setIsLive(true);
      } catch {
        setData([]);
        setIsLive(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetch();
    return () => controller.abort();
  }, [readOnlyClient, slug, maxEpochs]);

  return { data, isLive, loading };
}
