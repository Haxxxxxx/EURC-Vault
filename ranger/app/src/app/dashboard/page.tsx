'use client';

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
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Demo data</span>
              </>
            )}
          </div>
        </div>

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
