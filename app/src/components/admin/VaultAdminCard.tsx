'use client';

import { AdminVaultData } from '@/hooks/useAllVaultsAdmin';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { AdminEpochProgressBar } from './AdminEpochProgressBar';
import { Pause, Play } from '@phosphor-icons/react';

interface VaultAdminCardProps {
  vault: AdminVaultData;
}

export function VaultAdminCard({ vault }: VaultAdminCardProps) {
  const utilization = vault.capacity > 0 ? (vault.tvl / vault.capacity) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{vault.name}</h3>
          {!vault.isLive && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              Mock
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {vault.paused ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
              <Pause className="w-3 h-3" weight="bold" /> Paused
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
              <Play className="w-3 h-3" weight="bold" /> Active
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="TVL" value={`${formatEurcDisplay(vault.tvl)} EURC`} />
        <Stat label="APY" value={formatPercentage(vault.apy)} />
        <Stat label="Stakers" value={vault.stakerCount.toLocaleString()} />
        <Stat label="Capacity" value={`${utilization.toFixed(1)}%`} />
      </div>

      {/* Capacity bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-foreground-secondary">
          <span>Utilization</span>
          <span>{formatEurcDisplay(vault.tvl)} / {formatEurcDisplay(vault.capacity)}</span>
        </div>
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              utilization > 90 ? 'bg-red-500' : utilization > 70 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      </div>

      {/* Epoch progress */}
      <AdminEpochProgressBar
        epochStartTime={vault.epochStartTime}
        epochDuration={vault.epochDuration}
        currentEpoch={vault.currentEpoch}
      />

      {/* Rewards info */}
      <div className="flex items-center justify-between text-[10px] text-foreground-secondary pt-1 border-t border-border">
        <span>Total Rewards Funded</span>
        <span className="font-mono">{formatEurcDisplay(vault.totalRewardsFunded)} EURC</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-foreground-secondary">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
