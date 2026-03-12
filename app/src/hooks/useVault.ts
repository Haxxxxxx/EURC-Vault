import { useState, useEffect } from 'react';
import { VAULT_CONFIGS, EURC_DECIMALS } from '@/lib/constants';

export interface VaultData {
  id: string;
  name: string;
  description: string;
  apy: number;
  tvl: number;
  capacity: number;
  stakerCount: number;
  minDeposit: number;
  maxDeposit: number;
  withdrawalCooldown: number;
  rewardRate: number;
}

export function useVault(vaultId?: string) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVault = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 800));

        if (vaultId) {
          const config = Object.values(VAULT_CONFIGS).find((v) => v.id === vaultId);
          if (!config) {
            throw new Error('Vault not found');
          }

          const mockTvl = config.capacity * (0.65 + Math.random() * 0.2);
          const mockStakerCount = Math.floor(100 + Math.random() * 900);

          setVault({
            id: config.id,
            name: config.name,
            description: config.description,
            apy: config.apy,
            tvl: mockTvl,
            capacity: config.capacity,
            stakerCount: mockStakerCount,
            minDeposit: config.minDeposit,
            maxDeposit: config.maxDeposit,
            withdrawalCooldown: config.withdrawalCooldown,
            rewardRate: config.apy / 365,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch vault');
      } finally {
        setLoading(false);
      }
    };

    fetchVault();
  }, [vaultId]);

  return { vault, loading, error };
}

export function useVaults() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVaults = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 600));

        const mockVaults = Object.values(VAULT_CONFIGS).map((config) => {
          const mockTvl = config.capacity * (0.65 + Math.random() * 0.2);
          const mockStakerCount = Math.floor(100 + Math.random() * 900);

          return {
            id: config.id,
            name: config.name,
            description: config.description,
            apy: config.apy,
            tvl: mockTvl,
            capacity: config.capacity,
            stakerCount: mockStakerCount,
            minDeposit: config.minDeposit,
            maxDeposit: config.maxDeposit,
            withdrawalCooldown: config.withdrawalCooldown,
            rewardRate: config.apy / 365,
          };
        });

        setVaults(mockVaults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch vaults');
      } finally {
        setLoading(false);
      }
    };

    fetchVaults();
  }, []);

  return { vaults, loading, error };
}
