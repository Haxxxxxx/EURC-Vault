import { useCallback } from 'react';
import { useVaultStore, VaultInfo, UserStakeInfo } from '../store/useVaultStore';

export function useVaultData(vaultId?: string) {
  const vaults = useVaultStore((s) => s.vaults);
  const userStakes = useVaultStore((s) => s.userStakes);
  const refreshVaults = useVaultStore((s) => s.refreshVaults);

  const vault: VaultInfo | undefined = vaultId
    ? vaults.find((v) => v.id === vaultId)
    : undefined;

  const userStake: UserStakeInfo | undefined = vaultId
    ? userStakes[vaultId]
    : undefined;

  const totalStaked = Object.values(userStakes).reduce(
    (sum, s) => sum + s.depositedAmount,
    0
  );

  const totalPendingRewards = Object.values(userStakes).reduce(
    (sum, s) => sum + s.pendingRewards,
    0
  );

  const totalRewardsClaimed = Object.values(userStakes).reduce(
    (sum, s) => sum + s.totalRewardsClaimed,
    0
  );

  const refresh = useCallback(async () => {
    await refreshVaults();
  }, [refreshVaults]);

  return {
    vaults,
    vault,
    userStake,
    totalStaked,
    totalPendingRewards,
    totalRewardsClaimed,
    refresh,
  };
}
