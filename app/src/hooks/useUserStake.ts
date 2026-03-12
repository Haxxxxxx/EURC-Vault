import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { VAULT_REGISTRY, getVaultBySlug } from '@/lib/constants';
import { sharesToEurc, PRECISION } from '@eurc-vault/sdk';

export interface UserPositionData {
  slug: string;
  /** pbEURC balance in base units (6 decimals) */
  pbEurcBalance: number;
  /** Position value in EURC base units (6 decimals) — shares * exchangeRate */
  positionValueEurc: number;
  /** Current exchange rate (raw, scaled by PRECISION) */
  exchangeRate: number;
  /** Pending withdrawal in EURC base units */
  pendingWithdrawalEurc: number;
  /** Shares burned at withdrawal initiation */
  pendingWithdrawalShares: number;
  withdrawalAvailableAt: number;
  isInCooldown: boolean;
  cooldownComplete: boolean;
}

export function useUserStake(slug?: string) {
  const { publicKey, connected } = useWallet();
  const { client } = useVaultClient();
  const [stake, setStake] = useState<UserPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStake = useCallback(async () => {
    if (!connected || !publicKey || !slug || !client) {
      setStake(null);
      setLoading(false);
      return;
    }

    const entry = getVaultBySlug(slug);
    if (!entry) {
      setStake(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [userStake, vaultConfig, pbBalance] = await Promise.all([
        client.getUserStakeOrNull(entry.onChainId),
        client.getVaultConfigOrNull(entry.onChainId),
        client.getUserPbEurcBalance(entry.onChainId),
      ]);

      const pbEurcBalance = Number(pbBalance);
      const pendingWithdrawalEurc = userStake ? userStake.pendingWithdrawalEurc.toNumber() : 0;
      const pendingWithdrawalShares = userStake ? userStake.pendingWithdrawalShares.toNumber() : 0;

      // No position if user has no shares and no pending withdrawal
      if (pbEurcBalance === 0 && pendingWithdrawalEurc === 0) {
        setStake(null);
        setLoading(false);
        return;
      }

      const exchangeRate = vaultConfig
        ? Number(vaultConfig.exchangeRate.toString())
        : Number(PRECISION);

      // Calculate position value: shares * exchangeRate / PRECISION
      const positionValueEurc = pbEurcBalance > 0
        ? Number(sharesToEurc(BigInt(pbEurcBalance), BigInt(exchangeRate)))
        : 0;

      const withdrawalAt = userStake ? userStake.withdrawalAvailableAt.toNumber() : 0;
      const now = Math.floor(Date.now() / 1000);
      const isInCooldown = pendingWithdrawalEurc > 0 && withdrawalAt > 0;
      const cooldownComplete = isInCooldown && now >= withdrawalAt;

      setStake({
        slug,
        pbEurcBalance,
        positionValueEurc,
        exchangeRate,
        pendingWithdrawalEurc,
        pendingWithdrawalShares,
        withdrawalAvailableAt: withdrawalAt,
        isInCooldown,
        cooldownComplete,
      });
    } catch {
      // Account doesn't exist yet — new user
      setStake(null);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, slug, client]);

  useEffect(() => {
    fetchStake();
  }, [fetchStake]);

  return { stake, loading, error, refetch: fetchStake };
}

export function useUserPortfolio() {
  const { publicKey, connected } = useWallet();
  const { client } = useVaultClient();
  const [portfolio, setPortfolio] = useState<{
    totalPositionValue: number;
    activeVaults: number;
    positions: UserPositionData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!connected || !publicKey || !client) {
        setPortfolio(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const results = await Promise.allSettled(
          VAULT_REGISTRY.map(async (entry) => {
            const [userStake, vaultConfig, pbBalance] = await Promise.all([
              client.getUserStakeOrNull(entry.onChainId),
              client.getVaultConfigOrNull(entry.onChainId),
              client.getUserPbEurcBalance(entry.onChainId),
            ]);

            const pbEurcBalance = Number(pbBalance);
            const pendingEurc = userStake ? userStake.pendingWithdrawalEurc.toNumber() : 0;
            const pendingShares = userStake ? userStake.pendingWithdrawalShares.toNumber() : 0;

            if (pbEurcBalance === 0 && pendingEurc === 0) return null;

            const exchangeRate = vaultConfig
              ? Number(vaultConfig.exchangeRate.toString())
              : Number(PRECISION);

            const positionValueEurc = pbEurcBalance > 0
              ? Number(sharesToEurc(BigInt(pbEurcBalance), BigInt(exchangeRate)))
              : 0;

            const withdrawalAt = userStake ? userStake.withdrawalAvailableAt.toNumber() : 0;
            const now = Math.floor(Date.now() / 1000);

            return {
              slug: entry.slug,
              pbEurcBalance,
              positionValueEurc,
              exchangeRate,
              pendingWithdrawalEurc: pendingEurc,
              pendingWithdrawalShares: pendingShares,
              withdrawalAvailableAt: withdrawalAt,
              isInCooldown: pendingEurc > 0 && withdrawalAt > 0,
              cooldownComplete: pendingEurc > 0 && withdrawalAt > 0 && now >= withdrawalAt,
            } as UserPositionData;
          }),
        );

        const positions = results
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter((s): s is UserPositionData => s !== null);

        const totalPositionValue = positions.reduce(
          (sum, p) => sum + p.positionValueEurc + p.pendingWithdrawalEurc,
          0,
        );

        setPortfolio({
          totalPositionValue,
          activeVaults: positions.length,
          positions,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
        setPortfolio(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [connected, publicKey, client]);

  return { portfolio, loading, error };
}
