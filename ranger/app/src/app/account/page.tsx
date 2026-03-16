'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Wallet,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Shield,
  Clock,
  Coins,
  Percent,
  ArrowRightLeft,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useVaultState } from '@/hooks/useVaultState';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useRangerRates } from '@/hooks/useRangerRates';
import { MGMT_FEE_BPS, PERF_FEE_BPS, PROTOCOL_META } from '@/lib/constants';
import { formatTvl } from '@/lib/format';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';
import { clsx } from 'clsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof TrendingUp;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className={clsx('text-xl font-bold tabular-nums', accent ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-3 w-20 rounded bg-secondary animate-pulse mb-2" />
      <div className="h-6 w-28 rounded bg-secondary animate-pulse" />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AccountPage() {
  usePageTitle('Account');
  const { connected, publicKey } = useWallet();
  const vault = useVaultState();
  const { metrics } = useRangerMetrics();
  const { rates } = useRangerRates();

  const { eurcBalance, userShares, exchangeRate, tvl, loading } = vault;
  const positionValueEurc = userShares * exchangeRate;
  const yieldEarned = Math.max(0, (exchangeRate - 1) * userShares);
  const hasPosition = userShares > 0;

  // Estimated annual yield at current rates
  const currentApyPct = metrics?.currentApyPct ?? 0;
  const projectedAnnualYield = positionValueEurc * (currentApyPct / 100);

  // Fee estimates based on position
  const annualMgmtFee = positionValueEurc * (MGMT_FEE_BPS / 10_000);
  const annualPerfFee = projectedAnnualYield > 0 ? projectedAnnualYield * (PERF_FEE_BPS / 10_000) : 0;
  const netProjectedYield = projectedAnnualYield - annualMgmtFee - annualPerfFee;

  // Allocation display
  const allocation = useMemo(() => {
    if (!rates) return null;
    const protocols = (['drift', 'kamino', 'save'] as const).map((p) => ({
      id: p,
      label: PROTOCOL_META[p].label,
      color: PROTOCOL_META[p].color,
      apy: rates[p].apy * 100,
    }));
    return protocols.sort((a, b) => b.apy - a.apy);
  }, [rates]);

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-border bg-card p-10">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Connect a Solana wallet to view your vault position, yield earned, and fee breakdown.
            </p>
            <WalletMultiButton
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                borderRadius: '0.75rem',
                fontSize: '0.9375rem',
                fontWeight: '600',
                height: '3rem',
                padding: '0 1.5rem',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <div className="mt-8 flex items-center justify-center gap-6 text-sm">
              <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                How it works
              </Link>
              <Link href="/simulator" className="text-muted-foreground hover:text-foreground transition-colors">
                Strategy simulator
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Your Account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : ''}
              {vault.isLive && <span className="ml-2 text-emerald-400">On-chain data</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => vault.refetch()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Refresh balances"
            >
              <RefreshCw className={clsx('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </button>
            <Link
              href="/deposit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Deposit
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Error banner */}
        {vault.error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {vault.error}
          </div>
        )}

        {/* Portfolio overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {loading ? (
            <>
              {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </>
          ) : (
            <>
              <StatCard
                label="Position Value"
                value={hasPosition ? `€${positionValueEurc.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '€0'}
                sub={hasPosition ? `${userShares.toLocaleString(undefined, { maximumFractionDigits: 2 })} pbEURC` : 'No position yet'}
                icon={Coins}
                accent={hasPosition ? 'text-foreground' : 'text-muted-foreground'}
              />
              <StatCard
                label="Yield Earned"
                value={`+€${yieldEarned.toFixed(2)}`}
                sub={exchangeRate > 1 ? `Rate: 1 pbEURC = ${exchangeRate.toFixed(4)} EURC` : 'Exchange rate: 1:1'}
                icon={TrendingUp}
                accent="text-emerald-400"
              />
              <StatCard
                label="EURC Balance"
                value={`€${eurcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                sub="Available to deposit"
                icon={Wallet}
              />
              <StatCard
                label="Vault TVL"
                value={formatTvl(tvl)}
                sub={metrics ? `Blended ${metrics.currentApyPct.toFixed(2)}% APY` : 'Loading...'}
                icon={Shield}
              />
            </>
          )}
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Position details */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Position Details
            </h2>

            {!hasPosition ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  You don&apos;t have a position yet. Deposit EURC to start earning yield.
                </p>
                <Link
                  href="/deposit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
                >
                  Deposit EURC
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">pbEURC Shares</span>
                  <span className="text-sm font-semibold tabular-nums">{userShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Exchange Rate</span>
                  <span className="text-sm font-semibold tabular-nums">1 pbEURC = {exchangeRate.toFixed(6)} EURC</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Current Value</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-400">€{positionValueEurc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Yield Earned (est.)</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-400">+€{yieldEarned.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Yield %</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-400">
                    +{exchangeRate > 1 ? ((exchangeRate - 1) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Fee & projection breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Fee & Yield Projection
            </h2>

            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-muted-foreground">Projected annual yield (at current rates)</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                +€{netProjectedYield.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Net after fees · {currentApyPct.toFixed(2)}% blended APY
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
                <span className="text-muted-foreground">Gross yield (annual)</span>
                <span className="font-medium tabular-nums">+€{projectedAnnualYield.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
                <span className="text-muted-foreground">Management fee ({MGMT_FEE_BPS / 100}% annual)</span>
                <span className="font-medium tabular-nums text-red-400">-€{annualMgmtFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
                <span className="text-muted-foreground">Performance fee ({PERF_FEE_BPS / 100}% on profit)</span>
                <span className="font-medium tabular-nums text-red-400">-€{annualPerfFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 font-semibold">
                <span className="text-foreground">Net to you</span>
                <span className="text-emerald-400 tabular-nums">+€{netProjectedYield.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              Projections based on current protocol rates. Actual returns vary with market conditions.
              Performance fee uses high-water mark — never charged on drawdown recovery.
            </p>
          </div>
        </div>

        {/* Current allocation */}
        {allocation && (
          <div className="rounded-2xl border border-border bg-card p-6 mb-8">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Current Protocol Rates
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {allocation.map((p, i) => (
                <div
                  key={p.id}
                  className={clsx(
                    'rounded-xl border p-4',
                    i === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ProtocolIcon protocol={p.id} size={18} />
                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                    {i === 0 && (
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase">Best</span>
                    )}
                  </div>
                  <p className="text-xl font-bold tabular-nums" style={{ color: p.color }}>
                    {p.apy.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Supply APY</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Quick Actions
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Link
              href="/deposit"
              className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Deposit</p>
                <p className="text-[11px] text-muted-foreground">Add EURC to earn yield</p>
              </div>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                <TrendingUp className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Dashboard</p>
                <p className="text-[11px] text-muted-foreground">View strategy metrics</p>
              </div>
            </Link>
            <Link
              href="/simulator"
              className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Simulator</p>
                <p className="text-[11px] text-muted-foreground">Project your returns</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
