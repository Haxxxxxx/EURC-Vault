'use client';

import { PROTOCOL_META } from '@/lib/constants';
import type { RangerRatesDoc, ProtocolId } from '@/lib/types';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';
import { clsx } from 'clsx';

interface RateComparisonProps {
  rates: RangerRatesDoc | null;
  loading: boolean;
}

const PROTOCOLS: ProtocolId[] = ['drift', 'kamino', 'save'];
const MAX_APY_PCT = 15;

function SkeletonBar() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-12 rounded bg-secondary animate-pulse" />
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-secondary/80 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RateComparison({ rates, loading }: RateComparisonProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Live Protocol Rates</h2>
          {rates && !loading && (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-500 font-medium">Live</span>
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rates?.fetchedAt
            ? `Updated ${new Date(rates.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Refreshes every 30s'}
        </span>
      </div>

      {loading ? (
        <SkeletonBar />
      ) : (
        <div className="space-y-3">
          {PROTOCOLS.map((id) => {
            const rate = rates?.[id];
            const meta = PROTOCOL_META[id];
            const apyPct = rate ? rate.apy * 100 : 0;
            const fillPct = Math.min((apyPct / MAX_APY_PCT) * 100, 100);
            const isBest = rates?.best === id;
            const utilizationPct = rate ? (rate.utilization * 100).toFixed(0) : '—';

            return (
              <div
                key={id}
                className={clsx(
                  'rounded-xl border p-4 transition-all duration-200 hover:shadow-sm',
                  isBest
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                    : 'border-border bg-background-surface/50 hover:border-border/80',
                )}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <ProtocolIcon protocol={id} size={14} />
                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                    {isBest && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                        Best
                      </span>
                    )}
                    {rate?.isStale && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning uppercase tracking-wide">
                        Stale
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-xs text-muted-foreground">
                      {utilizationPct}% util
                    </span>
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: meta.color }}
                    >
                      {apyPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: meta.color,
                      opacity: rate?.isStale ? 0.5 : 1,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Spread footer */}
          {rates && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-2.5">
              <span className="text-xs text-muted-foreground">
                Rate spread ({PROTOCOL_META[rates.best].label} vs {PROTOCOL_META[rates.worst].label})
              </span>
              <span className={clsx(
                'text-sm font-semibold tabular-nums',
                rates.spreadBps >= 50 ? 'text-emerald-400' : 'text-muted-foreground',
              )}>
                {rates.spreadBps} bps
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
