'use client';

import { AlertTriangle, Activity, RefreshCw, Layers } from 'lucide-react';
import { clsx } from 'clsx';
import type { RangerMetrics } from '@/lib/types';
import { timeAgo } from '@/lib/format';

interface HealthGaugeProps {
  metrics: RangerMetrics | null;
  loading: boolean;
}

function getHealthColor(score: number): { text: string; ring: string; bg: string; stroke: string } {
  if (score >= 80) return { text: 'text-emerald-400', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10', stroke: '#10B981' };
  if (score >= 60) return { text: 'text-yellow-400', ring: 'ring-yellow-500/30', bg: 'bg-yellow-500/10', stroke: '#F59E0B' };
  return { text: 'text-red-400', ring: 'ring-red-500/30', bg: 'bg-red-500/10', stroke: '#EF4444' };
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Degraded';
  return 'Critical';
}


// SVG arc gauge helpers (extracted to module scope to avoid re-creation)
const ARC_RADIUS = 56;
const ARC_CX = 70;
const ARC_CY = 70;
const ARC_START = -210;
const ARC_TOTAL = 240;

function polarToCartesian(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: ARC_CX + ARC_RADIUS * Math.cos(rad), y: ARC_CY + ARC_RADIUS * Math.sin(rad) };
}

function describeArc(start: number, end: number) {
  const s = polarToCartesian(start);
  const e = polarToCartesian(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${large} 1 ${e.x} ${e.y}`;
}

function ArcGauge({ score, stroke }: { score: number; stroke: string }) {
  const endAngle = ARC_START + (score / 100) * ARC_TOTAL;

  return (
    <svg width="140" height="100" viewBox="0 0 140 100" className="overflow-visible" role="img" aria-label={`Health score: ${score} out of 100`}>
      {/* Track */}
      <path
        d={describeArc(ARC_START, ARC_START + ARC_TOTAL)}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={describeArc(ARC_START, endAngle)}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        style={{ transition: 'all 1s ease' }}
      />
    </svg>
  );
}

export function HealthGauge({ metrics, loading }: HealthGaugeProps) {
  const score = metrics?.healthScore ?? 0;
  const colors = getHealthColor(score);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Vault Health</h2>
        {metrics && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* Circuit breaker warning */}
      {metrics?.circuitBreakerTripped && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs font-medium text-red-400">
            Circuit breaker tripped — bot paused for safety
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="h-24 w-36 rounded bg-secondary animate-pulse" />
          </div>
          <div className="flex justify-center">
            <div className="h-10 w-20 rounded bg-secondary animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Gauge */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <ArcGauge score={score} stroke={colors.stroke} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                <span className={clsx('text-3xl font-bold tabular-nums', colors.text)}>
                  {score}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  {getHealthLabel(score)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center rounded-lg bg-secondary/40 p-2.5">
              <RefreshCw className="h-3.5 w-3.5 text-primary mb-1" />
              <span className="text-base font-bold text-foreground tabular-nums">
                {metrics?.rebalances24h ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                Rebalances<br />24h
              </span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-secondary/40 p-2.5">
              <Layers className="h-3.5 w-3.5 text-violet-400 mb-1" />
              <span className="text-base font-bold text-foreground tabular-nums">
                {metrics?.compounds24h ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                Compounds<br />24h
              </span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-secondary/40 p-2.5">
              <Activity className="h-3.5 w-3.5 text-emerald-400 mb-1" />
              <span className="text-base font-bold text-foreground tabular-nums">
                {metrics?.spreadBps ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                Spread<br />bps
              </span>
            </div>
          </div>

          {/* Rate stale warning */}
          {metrics?.ratesStale && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
              <p className="text-xs text-warning">Rate data may be stale</p>
            </div>
          )}

          {/* Last updated */}
          {metrics?.timestamp && (
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Updated {timeAgo(metrics.timestamp)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
