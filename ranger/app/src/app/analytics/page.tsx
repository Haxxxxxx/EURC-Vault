'use client';

import { Navbar } from '@/components/layout/Navbar';
import { ApyTrendChart } from '@/components/analytics/ApyTrendChart';
import { CumulativeYieldChart } from '@/components/analytics/CumulativeYieldChart';
import { EarningsCalculator } from '@/components/analytics/EarningsCalculator';
import { useMetricsHistory } from '@/hooks/useMetricsHistory';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';

export default function AnalyticsPage() {
  const { history, loading: historyLoading, isLive } = useMetricsHistory(7);
  const { metrics, loading: metricsLoading } = useRangerMetrics();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              7-day yield performance, APY trends, and earnings projections
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-emerald-400">Live data</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Demo data</span>
              </>
            )}
          </div>
        </div>

        {/* Summary stats */}
        {!metricsLoading && metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Current APY',   value: `${metrics.currentApyPct.toFixed(2)}%`,  sub: 'blended portfolio'       },
              { label: 'Rate Spread',   value: `${metrics.spreadBps} bps`,              sub: 'best vs worst protocol'  },
              { label: 'Rebalances',    value: String(metrics.rebalances24h),            sub: 'last 24 hours'           },
              { label: 'Compounds',     value: String(metrics.compounds24h),             sub: 'last 24 hours'           },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* APY trend chart — full width */}
        <div className="mb-6">
          <ApyTrendChart data={history} loading={historyLoading} />
        </div>

        {/* Bottom row: cumulative yield + earnings calculator */}
        <div className="grid lg:grid-cols-2 gap-6">
          <CumulativeYieldChart
            data={history}
            depositEurc={10_000}
            loading={historyLoading}
          />
          <EarningsCalculator metrics={metrics} />
        </div>
      </main>
    </div>
  );
}
