'use client';

import { useAllVaultsAdmin } from '@/hooks/useAllVaultsAdmin';
import { VaultOverviewGrid } from '@/components/admin/VaultOverviewGrid';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';

export default function AdminDashboard() {
  const { vaults, loading } = useAllVaultsAdmin();

  const totalTvl = vaults.reduce((acc, v) => acc + v.tvl, 0);
  const totalStakers = vaults.reduce((acc, v) => acc + v.stakerCount, 0);
  const avgApy = vaults.length > 0 ? vaults.reduce((acc, v) => acc + v.apy, 0) / vaults.length : 0;
  const totalRewards = vaults.reduce((acc, v) => acc + v.totalRewardsFunded, 0);
  const anyLive = vaults.some((v) => v.isLive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Monitor and manage all vault operations
        </p>
      </div>

      {!loading && !anyLive && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Program not deployed — showing mock data. Deploy vaults to see real on-chain data.
          </p>
        </div>
      )}

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AggStat label="Total TVL" value={`${formatEurcDisplay(totalTvl)} EURC`} />
        <AggStat label="Total Stakers" value={totalStakers.toLocaleString()} />
        <AggStat label="Avg APY" value={formatPercentage(avgApy)} />
        <AggStat label="Total Rewards" value={`${formatEurcDisplay(totalRewards)} EURC`} />
      </div>

      {/* Vault grid */}
      <VaultOverviewGrid vaults={vaults} loading={loading} />
    </div>
  );
}

function AggStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-foreground-secondary">{label}</p>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
