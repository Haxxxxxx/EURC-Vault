'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { RateComparison } from '@/components/dashboard/RateComparison';
import { useRangerRates } from '@/hooks/useRangerRates';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { PROTOCOL_META } from '@/lib/constants';
import { clsx } from 'clsx';

function StatCard({
  label,
  value,
  subtext,
  loading,
  accent,
}: {
  label: string;
  value: string;
  subtext?: string;
  loading: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 rounded bg-secondary animate-pulse" />
      ) : (
        <p
          className={clsx('mt-1 text-2xl font-bold tabular-nums', accent ?? 'text-foreground')}
        >
          {value}
        </p>
      )}
      {subtext && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

export default function HomePage() {
  const { rates, loading: ratesLoading } = useRangerRates();
  const { metrics, loading: metricsLoading } = useRangerMetrics();

  const loading = ratesLoading || metricsLoading;

  const currentApy = metrics?.currentApyPct ?? null;
  const tvl = metrics?.tvlEurc ?? null;
  const bestProtocol = rates?.best ?? null;
  const spreadBps = rates?.spreadBps ?? metrics?.spreadBps ?? null;
  const healthScore = metrics?.healthScore ?? null;

  function formatTvl(tvl: number): string {
    if (tvl >= 1_000_000) return `€${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `€${(tvl / 1_000).toFixed(1)}K`;
    return `€${tvl.toFixed(0)}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">Powered by Ranger Earn</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight text-balance">
            EURC Cross-Protocol
            <span className="block gradient-text">Yield Optimizer</span>
          </h1>

          <p className="mt-5 max-w-2xl mx-auto text-lg text-muted-foreground text-balance">
            Automated EURC yield maximization across Drift, Kamino, and Save.
            The bot continuously monitors rates and rebalances to always chase the highest APY.
          </p>

          {/* CTA */}
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/deposit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
            >
              Deposit EURC
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              View Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Current APY"
            value={currentApy !== null ? `${currentApy.toFixed(2)}%` : '—'}
            subtext="Blended across protocols"
            loading={loading}
            accent="text-emerald-400"
          />
          <StatCard
            label="Best Protocol"
            value={
              bestProtocol
                ? PROTOCOL_META[bestProtocol].label
                : '—'
            }
            subtext={
              bestProtocol && rates
                ? `${(rates[bestProtocol].apy * 100).toFixed(2)}% APY`
                : undefined
            }
            loading={loading}
            accent="text-primary"
          />
          <StatCard
            label="Rate Spread"
            value={spreadBps !== null ? `${spreadBps} bps` : '—'}
            subtext={spreadBps !== null && spreadBps >= 50 ? 'Rebalance threshold met' : 'Below threshold'}
            loading={loading}
          />
          <StatCard
            label="Health Score"
            value={healthScore !== null ? `${healthScore}/100` : '—'}
            subtext="Vault operational status"
            loading={loading}
            accent={
              healthScore !== null
                ? healthScore >= 80
                  ? 'text-emerald-400'
                  : healthScore >= 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
                : undefined
            }
          />
        </div>

        {/* Live rates + features */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Rate comparison (2/3 width) */}
          <div className="lg:col-span-2">
            <RateComparison rates={rates} loading={ratesLoading} />
          </div>

          {/* Feature cards (1/3 width) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Rate Arbitrage</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitors Drift, Kamino, and Save every 5 minutes. Rebalances automatically when the spread exceeds 50 bps.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                  <BarChart3 className="h-4.5 w-4.5 text-violet-400" />
                </div>
                <h3 className="font-semibold text-foreground">Auto-Compound</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Earned interest is automatically compounded back into the vault, maximizing long-term yield without manual intervention.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Shield className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-foreground">Circuit Breaker</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Built-in safety system pauses rebalancing during anomalous market conditions, protecting deposited capital.
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard CTA */}
        <div className="mt-10 flex items-center justify-center">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View Full Strategy Dashboard
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </main>
    </div>
  );
}
