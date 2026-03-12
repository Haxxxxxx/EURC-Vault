import { useState, useEffect } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { getVaultBySlug } from '@/lib/constants';
import { calculateApy } from '@eurc-vault/sdk';

export interface EpochHistoryEntry {
  epochNumber: number;
  totalEurcInVault: number;
  totalPbEurcSupply: number;
  exchangeRate: number;
  rewardsFundedThisEpoch: number;
  stakerCount: number;
  startTime: number;
  endTime: number;
  /** APY computed from exchange rate growth vs previous epoch */
  apy: number;
}

export function useEpochHistory(slug?: string) {
  const readOnlyClient = useReadOnlyClient();
  const [epochs, setEpochs] = useState<EpochHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!slug) {
        setEpochs([]);
        setLoading(false);
        return;
      }

      const entry = getVaultBySlug(slug);
      if (!entry) {
        setEpochs([]);
        setLoading(false);
        return;
      }

      if (!readOnlyClient) {
        setEpochs([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const snapshots = await readOnlyClient.getEpochHistory(entry.onChainId);

        const history: EpochHistoryEntry[] = snapshots.map((snap, index) => {
          const exchangeRate = Number(snap.exchangeRate.toString());
          const startTime = snap.startTime.toNumber();
          const endTime = snap.endTime.toNumber();
          const duration = endTime - startTime;

          // Compute APY from exchange rate growth vs previous epoch
          let apy = 0;
          if (index > 0) {
            const prevRate = Number(snapshots[index - 1].exchangeRate.toString());
            apy = calculateApy(prevRate, exchangeRate, duration);
          }

          return {
            epochNumber: snap.epochNumber.toNumber(),
            totalEurcInVault: snap.totalEurcInVault.toNumber(),
            totalPbEurcSupply: snap.totalPbEurcSupply.toNumber(),
            exchangeRate,
            rewardsFundedThisEpoch: snap.rewardsFundedThisEpoch.toNumber(),
            stakerCount: snap.stakerCount.toNumber(),
            startTime,
            endTime,
            apy,
          };
        });

        setEpochs(history);
      } catch {
        setEpochs([]);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [slug, readOnlyClient]);

  return { epochs, loading, error };
}
