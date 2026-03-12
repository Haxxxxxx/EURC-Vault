'use client';

import { useState, useEffect } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { VAULT_REGISTRY, MOCK_VAULT_DATA, type VaultRegistryEntry } from '@/lib/constants';
import { calculateApy } from '@eurc-vault/sdk';
import type { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';

export interface AdminVaultData {
  slug: string;
  onChainId: number;
  name: string;
  risk: string;
  apy: number;
  tvl: number;
  capacity: number;
  stakerCount: number;
  currentEpoch: number;
  epochDuration: number;
  epochStartTime: number;
  withdrawalCooldown: number;
  paused: boolean;
  authority: string;
  totalRewardsFunded: number;
  exchangeRate: number;
  totalPbEurcSupply: number;
  isLive: boolean;
}

function buildMockAdmin(entry: VaultRegistryEntry): AdminVaultData {
  const mock = MOCK_VAULT_DATA[entry.slug];
  return {
    slug: entry.slug,
    onChainId: entry.onChainId,
    name: entry.name,
    risk: 'Low',
    apy: mock?.apy ?? 5.0,
    tvl: mock?.tvl ?? 0,
    capacity: mock?.capacity ?? 10_000_000_000_000,
    stakerCount: mock?.stakerCount ?? 0,
    currentEpoch: mock?.currentEpoch ?? 1,
    epochDuration: mock?.epochDuration ?? 604_800,
    epochStartTime: mock?.epochStartTime ?? Math.floor(Date.now() / 1000),
    withdrawalCooldown: mock?.withdrawalCooldown ?? 86_400,
    paused: false,
    authority: '',
    totalRewardsFunded: 0,
    exchangeRate: 0,
    totalPbEurcSupply: 0,
    isLive: false,
  };
}

export function useAllVaultsAdmin() {
  const readOnlyClient = useReadOnlyClient();
  const [vaults, setVaults] = useState<AdminVaultData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      setLoading(true);

      if (!readOnlyClient) {
        if (!controller.signal.aborted) {
          setVaults(VAULT_REGISTRY.map(buildMockAdmin));
          setLoading(false);
        }
        return;
      }

      try {
        const results = await Promise.allSettled(
          VAULT_REGISTRY.map(async (entry) => {
            const config = await readOnlyClient.getVaultConfigOrNull(entry.onChainId);
            if (!config) return buildMockAdmin(entry);

            const totalEurcInVault = (config.totalEurcInVault as BN).toNumber();
            const maxCapacity = (config.maxCapacity as BN).toNumber();
            const epochDuration = (config.epochDuration as BN).toNumber();
            const totalRewardsFunded = (config.totalRewardsFunded as BN).toNumber();
            const exchangeRate = (config.exchangeRate as BN).toNumber();
            const totalPbEurcSupply = (config.totalPbEurcSupply as BN).toNumber();

            // Compute APY from the last two epoch snapshots
            let apy = 0;
            try {
              const snapshots = await readOnlyClient.getEpochHistory(entry.onChainId);
              if (snapshots.length >= 2) {
                const prev = snapshots[snapshots.length - 2];
                const last = snapshots[snapshots.length - 1];
                const duration = last.endTime.toNumber() - prev.endTime.toNumber();
                if (duration > 0) {
                  apy = calculateApy(
                    prev.exchangeRate.toNumber(),
                    last.exchangeRate.toNumber(),
                    duration,
                  );
                }
              }
            } catch {
              // Fall back to mock APY below
            }

            return {
              slug: entry.slug,
              onChainId: entry.onChainId,
              name: entry.name,
              risk: 'Low',
              apy: apy || MOCK_VAULT_DATA[entry.slug]?.apy || 5.0,
              tvl: totalEurcInVault,
              capacity: maxCapacity,
              stakerCount: (config.stakerCount as BN).toNumber(),
              currentEpoch: (config.currentEpoch as BN).toNumber(),
              epochDuration,
              epochStartTime: (config.epochStartTime as BN).toNumber(),
              withdrawalCooldown: (config.withdrawalCooldown as BN).toNumber(),
              paused: config.paused,
              authority: (config.authority as PublicKey).toBase58(),
              totalRewardsFunded,
              exchangeRate,
              totalPbEurcSupply,
              isLive: true,
            } as AdminVaultData;
          }),
        );

        if (controller.signal.aborted) return;

        setVaults(
          results.map((r, i) =>
            r.status === 'fulfilled' ? r.value : buildMockAdmin(VAULT_REGISTRY[i]),
          ),
        );
      } catch {
        if (!controller.signal.aborted) {
          setVaults(VAULT_REGISTRY.map(buildMockAdmin));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAll();
    return () => controller.abort();
  }, [readOnlyClient]);

  return { vaults, loading };
}
