'use client';

import { useState } from 'react';
import { useVaultParticipants, Participant } from '@/hooks/useVaultParticipants';
import { VAULT_REGISTRY } from '@/lib/constants';
import { formatEurcDisplay, truncateAddress, formatTimestamp } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArrowsClockwise, SortAscending, SortDescending, Clock, Warning } from '@phosphor-icons/react';

type SortField = 'pendingWithdrawalEurc' | 'lastInteractionTime';
type SortDir = 'asc' | 'desc';

export function ParticipantTable() {
  const [selectedVaultId, setSelectedVaultId] = useState(VAULT_REGISTRY[0].onChainId);
  const { participants, loading, refetch } = useVaultParticipants(selectedVaultId);
  const [sortField, setSortField] = useState<SortField>('lastInteractionTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = [...participants].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    return (a[sortField] - b[sortField]) * mul;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = sortDir === 'asc' ? SortAscending : SortDescending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={selectedVaultId}
          onChange={(e) => setSelectedVaultId(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {VAULT_REGISTRY.map((v) => (
            <option key={v.onChainId} value={v.onChainId}>
              {v.name}
            </option>
          ))}
        </select>

        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} weight="bold" />
          Refresh
        </button>

        <span className="text-xs text-foreground-secondary ml-auto">
          {participants.length} staker{participants.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary text-sm">
          No participants found for this vault
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-secondary">Wallet</th>
                  <SortableHeader
                    label="Pending EURC"
                    field="pendingWithdrawalEurc"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-secondary">Cooldown</th>
                  <SortableHeader
                    label="Last Active"
                    field="lastInteractionTime"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <ParticipantRow key={p.wallet} participant={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const isActive = current === field;
  const Icon = dir === 'asc' ? SortAscending : SortDescending;

  return (
    <th
      className="text-left px-4 py-3 text-xs font-medium text-foreground-secondary cursor-pointer hover:text-foreground transition-colors"
      onClick={() => onClick(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && <Icon className="w-3 h-3" weight="bold" />}
      </span>
    </th>
  );
}

function ParticipantRow({ participant: p }: { participant: Participant }) {
  const now = Math.floor(Date.now() / 1000);
  const hasPendingWithdrawal = p.pendingWithdrawalEurc > 0;
  const cooldownRemaining = hasPendingWithdrawal ? Math.max(p.withdrawalAvailableAt - now, 0) : 0;
  const cooldownReady = hasPendingWithdrawal && cooldownRemaining === 0;

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs">{truncateAddress(p.wallet, 6, 4)}</span>
      </td>
      <td className="px-4 py-3">
        {hasPendingWithdrawal ? (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {formatEurcDisplay(p.pendingWithdrawalEurc)} EURC
          </span>
        ) : (
          <span className="text-foreground-secondary">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {hasPendingWithdrawal ? (
          cooldownReady ? (
            <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
              <Warning className="w-3 h-3" weight="bold" /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-500 text-xs">
              <Clock className="w-3 h-3" weight="bold" />
              {Math.floor(cooldownRemaining / 3600)}h {Math.floor((cooldownRemaining % 3600) / 60)}m
            </span>
          )
        ) : (
          <span className="text-foreground-secondary text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-foreground-secondary">
        {p.lastInteractionTime > 0 ? formatTimestamp(p.lastInteractionTime * 1000) : '-'}
      </td>
    </tr>
  );
}
