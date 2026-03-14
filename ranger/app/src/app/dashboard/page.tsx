'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { RateComparison } from '@/components/dashboard/RateComparison';
import { ApyBreakdown } from '@/components/dashboard/ApyBreakdown';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { HealthGauge } from '@/components/dashboard/HealthGauge';
import { RebalanceHistory } from '@/components/dashboard/RebalanceHistory';
import { useRangerRates } from '@/hooks/useRangerRates';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useRebalanceHistory } from '@/hooks/useRebalanceHistory';

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { rates, loading: ratesLoading } = useRangerRates();
  const { metrics, loading: metricsLoading } = useRangerMetrics();
  const { history, loading: historyLoading } = useRebalanceHistory(20);

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
        {metricsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="h-3 w-16 rounded bg-secondary animate-pulse mb-2" />
                <div className="h-6 w-24 rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        ) : metrics && (
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
            <AllocationChart rates={rates} />
          </div>
        </div>

        {/* Full-width: Rebalance history */}
        <RebalanceHistory history={history} loading={historyLoading} />
      </main>
    </div>
  );
}
