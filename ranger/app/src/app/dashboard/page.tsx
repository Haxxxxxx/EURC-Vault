'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { RateComparison } from '@/components/dashboard/RateComparison';
import { ApyBreakdown } from '@/components/dashboard/ApyBreakdown';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { HealthGauge } from '@/components/dashboard/HealthGauge';
import { RebalanceHistory } from '@/components/dashboard/RebalanceHistory';
import { useRangerRates } from '@/hooks/useRangerRates';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useRebalanceHistory } from '@/hooks/useRebalanceHistory';

export default function DashboardPage() {
  const { rates, loading: ratesLoading, isLive: ratesLive } = useRangerRates();
  const { metrics, loading: metricsLoading, isLive: metricsLive } = useRangerMetrics();
  const { history, loading: historyLoading } = useRebalanceHistory(20);

  const isFullyLive = ratesLive && metricsLive;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Strategy Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live cross-protocol yield optimization metrics and rebalance activity
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live / Mock data indicator */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              {isFullyLive ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium text-emerald-400">Live data</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-medium text-primary">Demo mode</span>
                </>
              )}
            </div>

            <Link
              href="/deposit"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Deposit
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Quick stats row */}
        {!metricsLoading && metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Blended APY',  value: `${metrics.currentApyPct.toFixed(2)}%`,  accent: 'text-emerald-400' },
              { label: 'Rate Spread',  value: `${metrics.spreadBps} bps`,               accent: metrics.spreadBps >= 50 ? 'text-emerald-400' : 'text-muted-foreground' },
              { label: 'Health Score', value: `${metrics.healthScore}/100`,              accent: metrics.healthScore >= 80 ? 'text-emerald-400' : metrics.healthScore >= 60 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'TVL',          value: metrics.tvlEurc >= 1_000 ? `€${(metrics.tvlEurc / 1_000).toFixed(1)}K` : `€${metrics.tvlEurc}`, accent: 'text-foreground' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className={`text-lg font-bold tabular-nums mt-0.5 ${stat.accent}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main grid: 2-column layout */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Left column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <RateComparison rates={rates} loading={ratesLoading} />
            <ApyBreakdown rates={rates} metrics={metrics} loading={ratesLoading || metricsLoading} />
          </div>

          {/* Right column (1/3 width) */}
          <div className="space-y-6">
            <HealthGauge metrics={metrics} loading={metricsLoading} />
            <AllocationChart />
          </div>
        </div>

        {/* Full-width: Rebalance history */}
        <RebalanceHistory history={history} loading={historyLoading} />
      </main>
    </div>
  );
}
