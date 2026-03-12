'use client';

import { PROTOCOL_META } from '@/lib/constants';
import type { RangerRatesDoc, RangerMetrics, ProtocolId } from '@/lib/types';
import { clsx } from 'clsx';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ApyBreakdownProps {
  rates: RangerRatesDoc | null;
  metrics: RangerMetrics | null;
  loading: boolean;
}

const PROTOCOLS: ProtocolId[] = ['drift', 'kamino', 'save'];

// Mock allocations until vault goes live
const MOCK_ALLOCATION: Record<ProtocolId, number> = {
  drift: 50,
  kamino: 30,
  save: 15,
};

function StatusIcon({ utilization }: { utilization: number }) {
  if (utilization >= 0.85) {
    return <AlertTriangle className="h-4 w-4 text-warning" aria-label="High utilization" />;
  }
  return <CheckCircle className="h-4 w-4 text-emerald-500" aria-label="Normal" />;
}

function SkeletonRow() {
  return (
    <tr>
      {[0, 1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-secondary animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function ApyBreakdown({ rates, metrics, loading }: ApyBreakdownProps) {
  // Compute blended APY from metrics or rates
  const blendedApy = metrics?.currentApyPct ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">APY Breakdown</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Per-protocol rates and allocation</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Protocol
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current APY
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Utilization
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Allocation
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : (
              PROTOCOLS.map((id) => {
                const rate = rates?.[id];
                const meta = PROTOCOL_META[id];
                const apyPct = rate ? (rate.apy * 100).toFixed(2) : '—';
                const utilPct = rate ? (rate.utilization * 100).toFixed(1) : '—';
                const allocationPct = MOCK_ALLOCATION[id];
                const isBest = rates?.best === id;

                return (
                  <tr
                    key={id}
                    className={clsx(
                      'transition-colors',
                      isBest ? 'bg-emerald-500/5' : 'hover:bg-secondary/30',
                    )}
                  >
                    {/* Protocol name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        {isBest && (
                          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
                            Best
                          </span>
                        )}
                      </div>
                    </td>

                    {/* APY */}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {apyPct !== '—' ? `${apyPct}%` : '—'}
                    </td>

                    {/* Utilization */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={clsx(
                          'text-sm',
                          rate && rate.utilization >= 0.85
                            ? 'text-warning'
                            : 'text-muted-foreground',
                        )}
                      >
                        {utilPct !== '—' ? `${utilPct}%` : '—'}
                      </span>
                    </td>

                    {/* Allocation */}
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {allocationPct}%
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {rate ? (
                          <StatusIcon utilization={rate.utilization} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Footer: blended APY */}
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/20">
              <td className="px-4 py-3 font-semibold text-foreground">Blended APY</td>
              <td
                colSpan={4}
                className="px-4 py-3 text-right font-bold tabular-nums text-primary text-base"
              >
                {loading ? (
                  <div className="h-5 w-16 rounded bg-secondary animate-pulse ml-auto" />
                ) : blendedApy !== null ? (
                  `${blendedApy.toFixed(2)}%`
                ) : rates ? (
                  (() => {
                    const weighted =
                      (rates.drift.apy * MOCK_ALLOCATION.drift +
                        rates.kamino.apy * MOCK_ALLOCATION.kamino +
                        rates.save.apy * MOCK_ALLOCATION.save) /
                      (MOCK_ALLOCATION.drift + MOCK_ALLOCATION.kamino + MOCK_ALLOCATION.save);
                    return `${(weighted * 100).toFixed(2)}%`;
                  })()
                ) : (
                  '—'
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
