'use client';

import { useState } from 'react';
import { TrendingUp, ArrowRightLeft, Layers, Activity } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ApyTrendChart } from '@/components/analytics/ApyTrendChart';
import { CumulativeYieldChart } from '@/components/analytics/CumulativeYieldChart';
import { EarningsCalculator } from '@/components/analytics/EarningsCalculator';
import { useMetricsHistory } from '@/hooks/useMetricsHistory';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';

const DEPOSIT_OPTIONS = [1_000, 5_000, 10_000, 50_000, 100_000] as const;

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const { history, loading: historyLoading } = useMetricsHistory(7);
  const { metrics, loading: metricsLoading } = useRangerMetrics();
  const [simulatedDeposit, setSimulatedDeposit] = useState<number>(10_000);

  const statIcons = [TrendingUp, Activity, ArrowRightLeft, Layers];

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

        </div>

        {/* Summary stats */}
        {metricsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="h-3 w-16 rounded bg-secondary animate-pulse mb-2" />
                <div className="h-6 w-20 rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        ) : metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Blended APY',   value: `${metrics.currentApyPct.toFixed(2)}%`,  accent: 'text-emerald-400' },
              { label: 'Rate Spread',   value: `${metrics.spreadBps} bps`,              accent: metrics.spreadBps >= 50 ? 'text-emerald-400' : 'text-foreground' },
              { label: 'Rebalances',    value: String(metrics.rebalances24h),            accent: 'text-foreground' },
              { label: 'Compounds',     value: String(metrics.compounds24h),             accent: 'text-foreground' },
            ].map((stat, i) => {
              const Icon = statIcons[i];
              return (
                <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${stat.accent}`}>{stat.value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* APY trend chart — full width */}
        <div className="mb-6">
          <ApyTrendChart data={history} loading={historyLoading} />
        </div>

        {/* Deposit size selector for cumulative chart */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Simulate deposit:</span>
          <div className="flex gap-1.5">
            {DEPOSIT_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setSimulatedDeposit(amount)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  simulatedDeposit === amount
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                {amount >= 1_000 ? `€${amount / 1_000}K` : `€${amount}`}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom row: cumulative yield + earnings calculator */}
        <div className="grid lg:grid-cols-2 gap-6">
          <CumulativeYieldChart
            data={history}
            depositEurc={simulatedDeposit}
            loading={historyLoading}
          />
          <EarningsCalculator metrics={metrics} />
        </div>
      </main>
    </div>
  );
}
