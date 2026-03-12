'use client';

import { AdminVaultData } from '@/hooks/useAllVaultsAdmin';
import { VaultAdminCard } from './VaultAdminCard';
import { Skeleton } from '@/components/ui/Skeleton';

interface VaultOverviewGridProps {
  vaults: AdminVaultData[];
  loading: boolean;
}

export function VaultOverviewGrid({ vaults, loading }: VaultOverviewGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {vaults.map((vault) => (
        <VaultAdminCard key={vault.onChainId} vault={vault} />
      ))}
    </div>
  );
}
