'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Zap, BarChart3, ArrowRightLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { RateComparison } from '@/components/dashboard/RateComparison';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';
import { useRangerRates } from '@/hooks/useRangerRates';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useToast } from '@/components/ui/Toast';
import { PROTOCOL_META, REBALANCE_MIN_SPREAD_BPS } from '@/lib/constants';
import { formatTvl } from '@/lib/format';
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

/** Animated protocol flow visualization for the hero section */
function ProtocolFlowVisual() {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5 py-8">
      {/* EURC source */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-card border border-border shadow-lg">
          <span className="text-lg sm:text-xl font-bold text-foreground">€</span>
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">EURC</span>
      </div>

      {/* Animated arrows */}
      <div className="flex flex-col items-center gap-0.5">
        <ArrowRightLeft className="h-5 w-5 text-primary animate-pulse" />
        <span className="text-[9px] text-primary font-medium">AUTO</span>
      </div>

      {/* Protocol nodes */}
      <div className="flex flex-col items-center gap-1.5 sm:gap-2.5">
        {(['drift', 'kamino', 'save'] as const).map((id) => (
          <div key={id} className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border shadow-md"
              style={{ backgroundColor: `${PROTOCOL_META[id].color}15` }}
            >
              <ProtocolIcon protocol={id} size={20} />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-medium text-foreground">{PROTOCOL_META[id].label}</span>
              <span className="text-[10px] text-muted-foreground">Lending</span>
            </div>
          </div>
        ))}
      </div>

      {/* Arrow to yield */}
      <div className="flex flex-col items-center gap-0.5">
        <ArrowRight className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Yield output */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <span className="text-base sm:text-lg font-bold text-emerald-400">APY</span>
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">12-15%</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { rates, loading: ratesLoading } = useRangerRates();
  const { metrics, loading: metricsLoading } = useRangerMetrics();
  const { toast } = useToast();
  const hasShownSpreadAlert = useRef(false);

  useEffect(() => {
    if (!rates || hasShownSpreadAlert.current) return;
    if (rates.spreadBps >= REBALANCE_MIN_SPREAD_BPS) {
      toast(
        `${PROTOCOL_META[rates.best].label} at ${(rates[rates.best].apy * 100).toFixed(2)}% vs ${PROTOCOL_META[rates.worst].label} at ${(rates[rates.worst].apy * 100).toFixed(2)}% — ${rates.spreadBps} bps spread`,
        { type: 'info', title: 'Rate Spread Alert', duration: 8000 },
      );
      hasShownSpreadAlert.current = true;
    }
  }, [rates, toast]);

  const loading = ratesLoading || metricsLoading;

  const currentApy = metrics?.currentApyPct ?? null;
  const bestProtocol = rates?.best ?? null;
  const spreadBps = rates?.spreadBps ?? metrics?.spreadBps ?? null;
  const healthScore = metrics?.healthScore ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          {/* Badges */}
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">Powered by Ranger Earn</span>
            </div>
            {rates && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-emerald-400 tabular-nums">
                  {rates.spreadBps} bps spread — {PROTOCOL_META[rates.best].label} leading
                </span>
              </div>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight text-balance">
            EURC Cross-Protocol
            <span className="block gradient-text">Yield Optimizer</span>
          </h1>

          <p className="mt-5 max-w-2xl mx-auto text-lg text-muted-foreground text-balance">
            Automated EURC yield maximization across Drift, Kamino, and Save.
            The bot continuously monitors rates and rebalances to always chase the highest APY.
          </p>

          {/* Protocol flow visualization */}
          <ProtocolFlowVisual />

          {/* CTA */}
          <div className="flex items-center justify-center gap-3 flex-wrap sm:gap-4">
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
            subtext="Live blended rate (target 10%+ in active markets)"
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
            subtext={spreadBps === null ? 'Loading rates...' : spreadBps >= 50 ? 'Rebalance threshold met' : 'Below rebalance threshold'}
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
                Earned interest is automatically compounded back into the vault hourly, maximizing long-term yield through the power of compounding.
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
                Built-in safety system halts all activity if TVL drops more than 2% from peak, pulling funds back to idle to protect capital.
              </p>
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="mt-14 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">How It Works</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-xl mx-auto">
            Deposit EURC and receive pbEURC — yield-bearing receipt tokens that grow in value as the vault earns.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-3">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Deposit EURC</h3>
              <p className="text-xs text-muted-foreground">
                Connect your wallet and deposit EURC into the vault. You receive pbEURC shares in return.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 mx-auto mb-3">
                <span className="text-sm font-bold text-violet-400">2</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Bot Optimizes</h3>
              <p className="text-xs text-muted-foreground">
                The bot monitors rates across Drift, Kamino, and Save — rebalancing to the highest-yield protocol automatically.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 mx-auto mb-3">
                <span className="text-sm font-bold text-emerald-400">3</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Earn Yield</h3>
              <p className="text-xs text-muted-foreground">
                Your pbEURC shares grow in value. Withdraw anytime to receive more EURC than you deposited — no claiming needed.
              </p>
            </div>
          </div>
        </div>

        {/* Why Ranger — comparison */}
        <div className="mt-14 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-foreground text-center mb-2">Why Ranger?</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            How the optimizer compares to alternatives for EURC holders on Solana.
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Strategy</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected APY</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Effort</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-emerald-500/30 bg-emerald-500/8">
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Ranger Optimizer
                  </td>
                  <td className="text-center px-4 py-3 font-bold text-emerald-400 tabular-nums">10-15%</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">Diversified · Circuit breaker</td>
                  <td className="text-center px-4 py-3 text-xs text-emerald-400 font-medium">None (automated)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Single Protocol (Drift)
                  </td>
                  <td className="text-center px-4 py-3 tabular-nums">5-10%</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">Concentrated · No safety net</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">Manual monitoring</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                    Hold EURC (no yield)
                  </td>
                  <td className="text-center px-4 py-3 tabular-nums">0%</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">No smart contract risk</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">None</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Manual Rebalancing
                  </td>
                  <td className="text-center px-4 py-3 tabular-nums">8-12%</td>
                  <td className="text-center px-4 py-3 text-xs text-muted-foreground">Depends on timing</td>
                  <td className="text-center px-4 py-3 text-xs text-yellow-400 font-medium">24/7 monitoring</td>
                </tr>
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-secondary/20 border-t border-border">
              <p className="text-[11px] text-muted-foreground text-center">
                APY ranges reflect active market conditions. During quiet periods, all strategies earn less.
              </p>
            </div>
          </div>
        </div>

        {/* Fee disclosure + CTAs */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5 max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground font-medium">
                0.5% management fee · 10% performance fee on profits
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No hidden fees. No lock-ups. Withdraw anytime.
              </p>
            </div>
            <Link
              href="/docs"
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors whitespace-nowrap"
            >
              Learn more →
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View Strategy Dashboard
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/docs"
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
