'use client';

import { ExternalLink, ArrowRightLeft, SkipForward, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import type { RebalanceRecord } from '@/lib/types';
import { explorerTxUrl } from '@/lib/constants';
import { PROTOCOL_META } from '@/lib/constants';

interface RebalanceHistoryProps {
  history: RebalanceRecord[];
  loading: boolean;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 p-4">
      <div className="h-8 w-8 rounded-full bg-secondary animate-pulse flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-20 rounded-full bg-secondary animate-pulse" />
          <div className="h-4 w-12 rounded bg-secondary animate-pulse ml-auto" />
        </div>
        <div className="h-4 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

export function RebalanceHistory({ history, loading }: RebalanceHistoryProps) {
  const displayed = history.slice(0, 10);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">Rebalance History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Recent bot decisions</p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {!loading && `${history.length} records`}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {loading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No rebalance history yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              The bot will log decisions here as it runs
            </p>
          </div>
        ) : (
          displayed.map((record) => {
            const isRebalance = record.decision === 'REBALANCE';
            return (
              <div key={record.timestamp} className="flex items-start gap-3 p-4 hover:bg-secondary/30 transition-all duration-150">
                {/* Icon */}
                <div
                  className={clsx(
                    'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                    isRebalance ? 'bg-emerald-500/15' : 'bg-secondary',
                  )}
                >
                  {isRebalance ? (
                    <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <SkipForward className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Decision badge */}
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                        isRebalance
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {record.decision}
                    </span>

                    {/* Protocol route */}
                    {isRebalance && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span style={{ color: PROTOCOL_META[record.lowestRateProtocol].color }}>
                          {PROTOCOL_META[record.lowestRateProtocol].label}
                        </span>
                        <span>→</span>
                        <span style={{ color: PROTOCOL_META[record.highestRateProtocol].color }}>
                          {PROTOCOL_META[record.highestRateProtocol].label}
                        </span>
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums flex-shrink-0">
                      {timeAgo(record.timestamp)}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="mt-1 text-xs text-muted-foreground truncate">{record.reason}</p>

                  {/* Stats row */}
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-foreground/70">
                      Spread:{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        {record.spreadBps} bps
                      </span>
                    </span>
                    {isRebalance && record.estimatedGainBps > 0 && (
                      <span className="text-xs text-foreground/70">
                        Est. gain:{' '}
                        <span className="font-medium text-emerald-400 tabular-nums">
                          +{record.estimatedGainBps} bps
                        </span>
                      </span>
                    )}
                    {record.txSig && (
                      <a
                        href={explorerTxUrl(record.txSig!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Explorer
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
