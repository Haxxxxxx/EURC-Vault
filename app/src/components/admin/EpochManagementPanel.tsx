'use client';

import { useState, useEffect } from 'react';
import { useAdvanceEpoch } from '@/hooks/useAdvanceEpoch';
import { useAllVaultsAdmin } from '@/hooks/useAllVaultsAdmin';
import { VAULT_REGISTRY } from '@/lib/constants';
import { formatCountdown } from '@/lib/utils';
import { ArrowClockwise, Spinner, CheckCircle, Clock } from '@phosphor-icons/react';

export function EpochManagementPanel() {
  const { advanceEpoch, loading } = useAdvanceEpoch();
  const { vaults } = useAllVaultsAdmin();

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Epoch Management</h3>
        <p className="text-xs text-foreground-secondary mt-1">
          Advance epochs when they expire to create on-chain snapshots
        </p>
      </div>

      <div className="space-y-3">
        {vaults.map((vault) => (
          <EpochRow
            key={vault.onChainId}
            vaultName={vault.name}
            vaultId={vault.onChainId}
            epochStartTime={vault.epochStartTime}
            epochDuration={vault.epochDuration}
            currentEpoch={vault.currentEpoch}
            onAdvance={() => advanceEpoch(vault.onChainId)}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}

function EpochRow({
  vaultName,
  vaultId,
  epochStartTime,
  epochDuration,
  currentEpoch,
  onAdvance,
  loading,
}: {
  vaultName: string;
  vaultId: number;
  epochStartTime: number;
  epochDuration: number;
  currentEpoch: number;
  onAdvance: () => void;
  loading: boolean;
}) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const epochEnd = epochStartTime + epochDuration;
  const remaining = Math.max(epochEnd - now, 0);
  const isExpired = remaining <= 0;
  const cd = formatCountdown(remaining);

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center gap-3">
        {isExpired ? (
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <ArrowClockwise className="w-4 h-4 text-amber-500" weight="bold" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-emerald-500" weight="bold" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{vaultName}</p>
          <p className="text-[10px] text-foreground-secondary">
            Epoch {currentEpoch} {isExpired ? '- Expired' : `- ${cd.days}d ${cd.hours}h ${cd.minutes}m left`}
          </p>
        </div>
      </div>
      <button
        onClick={onAdvance}
        disabled={!isExpired || loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary-hover"
      >
        {loading ? (
          <Spinner className="w-3 h-3 animate-spin" />
        ) : (
          <ArrowClockwise className="w-3 h-3" weight="bold" />
        )}
        Advance
      </button>
    </div>
  );
}
