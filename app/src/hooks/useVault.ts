import { useState, useEffect, useCallback } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import {
  VAULT_REGISTRY,
  MOCK_VAULT_DATA,
  getVaultBySlug,
  type VaultRegistryEntry,
} from '@/lib/constants';

export interface VaultData {
  slug: string;
  onChainId: number;
  name: string;
  description: string;
  risk: string;
  riskVariant: 'success' | 'warning' | 'info';
  lockPeriodLabel: string;
  minDepositLabel: string;
  /** Minimum deposit in base units (e.g. 100 EURC = 100_000_000) */
  minDeposit: number;
  apy: number;
  /** Total EURC held in vault (deposits + funded rewards) — base units */
  tvl: number;
  capacity: number;
  stakerCount: number;
  currentEpoch: number;
  epochDuration: number;
  epochStartTime: number;
  withdrawalCooldown: number;
  paused: boolean;
  isLive: boolean;
  /** Exchange rate: EURC per pbEURC, raw u128 scaled by PRECISION (10^12) */
  exchangeRate: number;
  /** Total EURC in vault (same as tvl, exposed for clarity) */
  totalEurcInVault: number;
  /** Total pbEURC supply minted */
  totalPbEurcSupply: number;
  /** Cumulative rewards funded */
  totalRewardsFunded: number;
}

function buildMockVault(entry: VaultRegistryEntry): VaultData {
  const mock = MOCK_VAULT_DATA[entry.slug];
  return {
    slug: entry.slug,
    onChainId: entry.onChainId,
    name: entry.name,
    description: entry.description,
    risk: entry.risk,
    riskVariant: entry.riskVariant,
    lockPeriodLabel: entry.lockPeriodLabel,
    minDepositLabel: entry.minDepositLabel,
    minDeposit: entry.minDeposit,
    apy: mock?.apy ?? 5.0,
    tvl: mock?.tvl ?? 0,
    capacity: mock?.capacity ?? 10_000_000_000_000,
    stakerCount: mock?.stakerCount ?? 0,
    currentEpoch: mock?.currentEpoch ?? 1,
    epochDuration: mock?.epochDuration ?? 172_800,
    epochStartTime: mock?.epochStartTime ?? Math.floor(Date.now() / 1000),
    withdrawalCooldown: mock?.withdrawalCooldown ?? 86_400,
    paused: false,
    isLive: false,
    exchangeRate: mock?.exchangeRate ?? 1_000_000_000_000,
    totalEurcInVault: mock?.tvl ?? 0,
    totalPbEurcSupply: mock?.totalPbEurcSupply ?? 0,
    totalRewardsFunded: mock?.totalRewardsFunded ?? 0,
  };
}

export function useVault(slug?: string) {
  const readOnlyClient = useReadOnlyClient();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVault = useCallback(async (signal?: AbortSignal) => {
    if (!slug) {
      setVault(null);
      setLoading(false);
      return;
    }

    const entry = getVaultBySlug(slug);
    if (!entry) {
      setError('Vault not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!readOnlyClient) {
        if (!signal?.aborted) {
          setVault(buildMockVault(entry));
          setLoading(false);
        }
        return;
      }

      const onChain = await readOnlyClient.getVaultConfigOrNull(entry.onChainId);

      if (signal?.aborted) return;

      if (onChain) {
        const totalEurcInVault = onChain.totalEurcInVault.toNumber();
        const totalPbEurcSupply = onChain.totalPbEurcSupply.toNumber();
        const exchangeRate = Number(onChain.exchangeRate.toString());
        const totalRewardsFunded = onChain.totalRewardsFunded.toNumber();
        const maxCapacity = onChain.maxCapacity.toNumber();
        const epochDuration = onChain.epochDuration.toNumber();

        setVault({
          slug: entry.slug,
          onChainId: entry.onChainId,
          name: entry.name,
          description: entry.description,
          risk: entry.risk,
          riskVariant: entry.riskVariant,
          lockPeriodLabel: entry.lockPeriodLabel,
          minDepositLabel: entry.minDepositLabel,
          minDeposit: entry.minDeposit,
          apy: MOCK_VAULT_DATA[slug]?.apy || 5.0,
          tvl: totalEurcInVault,
          capacity: maxCapacity,
          stakerCount: onChain.stakerCount.toNumber(),
          currentEpoch: onChain.currentEpoch.toNumber(),
          epochDuration,
          epochStartTime: onChain.epochStartTime.toNumber(),
          withdrawalCooldown: onChain.withdrawalCooldown.toNumber(),
          paused: onChain.paused,
          isLive: true,
          exchangeRate,
          totalEurcInVault,
          totalPbEurcSupply,
          totalRewardsFunded,
        });
      } else {
        // Program not deployed or vault doesn't exist — use mock
        setVault(buildMockVault(entry));
      }
    } catch {
      if (!signal?.aborted) {
        // Fallback to mock on any RPC error
        setVault(buildMockVault(entry));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [slug, readOnlyClient]);

  useEffect(() => {
    const controller = new AbortController();
    fetchVault(controller.signal);
    return () => controller.abort();
  }, [fetchVault]);

  return { vault, loading, error, refetch: fetchVault };
}

export function useVaults() {
  const readOnlyClient = useReadOnlyClient();
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!readOnlyClient) {
          if (!signal.aborted) {
            setVaults(VAULT_REGISTRY.map(buildMockVault));
            setLoading(false);
          }
          return;
        }

        const results = await Promise.allSettled(
          VAULT_REGISTRY.map(async (entry) => {
            try {
              const onChain = await readOnlyClient.getVaultConfigOrNull(entry.onChainId);
              if (onChain) {
                const totalEurcInVault = onChain.totalEurcInVault.toNumber();
                const totalPbEurcSupply = onChain.totalPbEurcSupply.toNumber();
                const exchangeRate = Number(onChain.exchangeRate.toString());
                const totalRewardsFunded = onChain.totalRewardsFunded.toNumber();
                const epochDuration = onChain.epochDuration.toNumber();

                return {
                  slug: entry.slug,
                  onChainId: entry.onChainId,
                  name: entry.name,
                  description: entry.description,
                  risk: entry.risk,
                  riskVariant: entry.riskVariant,
                  lockPeriodLabel: entry.lockPeriodLabel,
                  minDepositLabel: entry.minDepositLabel,
                  minDeposit: entry.minDeposit,
                  apy: MOCK_VAULT_DATA[entry.slug]?.apy || 5.0,
                  tvl: totalEurcInVault,
                  capacity: onChain.maxCapacity.toNumber(),
                  stakerCount: onChain.stakerCount.toNumber(),
                  currentEpoch: onChain.currentEpoch.toNumber(),
                  epochDuration,
                  epochStartTime: onChain.epochStartTime.toNumber(),
                  withdrawalCooldown: onChain.withdrawalCooldown.toNumber(),
                  paused: onChain.paused,
                  isLive: true,
                  exchangeRate,
                  totalEurcInVault,
                  totalPbEurcSupply,
                  totalRewardsFunded,
                } as VaultData;
              }
            } catch {
              // Fall through to mock
            }
            return buildMockVault(entry);
          }),
        );

        if (signal.aborted) return;

        const vaultList = results.map((r) =>
          r.status === 'fulfilled' ? r.value : buildMockVault(VAULT_REGISTRY[0]),
        );

        setVaults(vaultList);
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch vaults');
          setVaults(VAULT_REGISTRY.map(buildMockVault));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchAll();
    return () => controller.abort();
  }, [readOnlyClient]);

  return { vaults, loading, error };
}
