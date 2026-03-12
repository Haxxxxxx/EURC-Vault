import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { EURC_DECIMALS } from '@/lib/constants';

export interface UserStakeData {
  vaultId: string;
  stakedAmount: number;
  rewardsEarned: number;
  sharePercentage: number;
  cooldownStartTime: number | null;
  cooldownEndTime: number | null;
}

export function useUserStake(vaultId?: string) {
  const { publicKey, connected } = useWallet();
  const [stake, setStake] = useState<UserStakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStake = async () => {
      if (!connected || !publicKey || !vaultId) {
        setStake(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 500));

        const mockStakedAmount = Math.floor(
          (5000 + Math.random() * 45000) * Math.pow(10, EURC_DECIMALS)
        );
        const mockRewards = Math.floor(
          (50 + Math.random() * 500) * Math.pow(10, EURC_DECIMALS)
        );

        const hasCooldown = Math.random() > 0.7;
        const cooldownStart = hasCooldown ? Date.now() - 2 * 24 * 60 * 60 * 1000 : null;
        const cooldownEnd = hasCooldown ? Date.now() + 5 * 24 * 60 * 60 * 1000 : null;

        setStake({
          vaultId,
          stakedAmount: mockStakedAmount,
          rewardsEarned: mockRewards,
          sharePercentage: 0.05 + Math.random() * 0.15,
          cooldownStartTime: cooldownStart,
          cooldownEndTime: cooldownEnd,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stake');
      } finally {
        setLoading(false);
      }
    };

    fetchStake();
  }, [connected, publicKey, vaultId]);

  return { stake, loading, error, refetch: () => {} };
}

export function useUserPortfolio() {
  const { publicKey, connected } = useWallet();
  const [portfolio, setPortfolio] = useState<{
    totalStaked: number;
    totalRewards: number;
    activeVaults: number;
    stakes: UserStakeData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!connected || !publicKey) {
        setPortfolio(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 700));

        const mockStakes: UserStakeData[] = ['standard', 'premium'].map((vaultId) => ({
          vaultId,
          stakedAmount: Math.floor((10000 + Math.random() * 40000) * Math.pow(10, EURC_DECIMALS)),
          rewardsEarned: Math.floor((100 + Math.random() * 900) * Math.pow(10, EURC_DECIMALS)),
          sharePercentage: 0.05 + Math.random() * 0.15,
          cooldownStartTime: null,
          cooldownEndTime: null,
        }));

        const totalStaked = mockStakes.reduce((sum, s) => sum + s.stakedAmount, 0);
        const totalRewards = mockStakes.reduce((sum, s) => sum + s.rewardsEarned, 0);

        setPortfolio({
          totalStaked,
          totalRewards,
          activeVaults: mockStakes.length,
          stakes: mockStakes,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [connected, publicKey]);

  return { portfolio, loading, error };
}
