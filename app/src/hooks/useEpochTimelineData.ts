'use client';

import { useState, useEffect } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { getVaultBySlug, EURC_DECIMALS } from '@/lib/constants';

export interface TimelineEpoch {
  epochNumber: number;
  startTime: number;
  endTime: number;
  totalEurcInVault: number;
  rewardsFundedThisEpoch: number;
  exchangeRate: number;
  stakerCount: number;
  status: 'completed' | 'current' | 'upcoming';
}

/**
 * Fetch epoch timeline data for a vault.
 * Returns completed epochs + current epoch status.
 */
export function useEpochTimelineData(slug?: string) {
  const readOnlyClient = useReadOnlyClient();
  const [epochs, setEpochs] = useState<TimelineEpoch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!readOnlyClient || !slug) {
      setEpochs([]);
      setLoading(false);
      return;
    }

    const entry = getVaultBySlug(slug);
    if (!entry) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetch() {
      try {
        setLoading(true);
        const vaultConfig = await readOnlyClient!.getVaultConfigOrNull(entry!.onChainId);
        if (!vaultConfig || controller.signal.aborted) {
          setEpochs([]);
          setIsLive(false);
          setLoading(false);
          return;
        }

        const currentEpoch = vaultConfig.currentEpoch.toNumber();
        const snapshots = await readOnlyClient!.getEpochHistory(entry!.onChainId);

        if (controller.signal.aborted) return;

        const timeline: TimelineEpoch[] = snapshots.map((snap) => ({
          epochNumber: snap.epochNumber.toNumber(),
          startTime: snap.startTime.toNumber(),
          endTime: snap.endTime.toNumber(),
          totalEurcInVault: snap.totalEurcInVault.toNumber() / Math.pow(10, EURC_DECIMALS),
          rewardsFundedThisEpoch: snap.rewardsFundedThisEpoch.toNumber() / Math.pow(10, EURC_DECIMALS),
          exchangeRate: snap.exchangeRate.toNumber(),
          stakerCount: snap.stakerCount.toNumber(),
          status: 'completed' as const,
        }));

        // Add current epoch
        const now = Math.floor(Date.now() / 1000);
        const epochEnd = vaultConfig.epochStartTime.toNumber() + vaultConfig.epochDuration.toNumber();

        timeline.push({
          epochNumber: currentEpoch,
          startTime: vaultConfig.epochStartTime.toNumber(),
          endTime: epochEnd,
          totalEurcInVault: vaultConfig.totalEurcInVault.toNumber() / Math.pow(10, EURC_DECIMALS),
          rewardsFundedThisEpoch: 0,
          exchangeRate: vaultConfig.exchangeRate.toNumber(),
          stakerCount: vaultConfig.stakerCount.toNumber(),
          status: now >= epochEnd ? 'completed' : 'current',
        });

        setEpochs(timeline);
        setIsLive(true);
      } catch {
        setEpochs([]);
        setIsLive(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetch();
    return () => controller.abort();
  }, [readOnlyClient, slug]);

  return { epochs, loading, isLive };
}
