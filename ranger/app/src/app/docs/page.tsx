'use client';

import Link from 'next/link';
import { ArrowLeft, TrendingUp, Shield, Zap, ArrowRightLeft, Clock, AlertTriangle, Layers, Percent } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PROTOCOL_META } from '@/lib/constants';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';
import { clsx } from 'clsx';

// ─── Data ───────────────────────────────────────────────────────────────────

const STRATEGY_PARAMS = [
  { label: 'Min Spread Trigger', value: '50 bps', description: 'Minimum rate gap between best and worst protocol before a rebalance fires. Filters noise — small spreads don\'t justify the operational overhead.' },
  { label: 'Max Allocation', value: '70%', description: 'No single protocol can hold more than 70% of TVL. Prevents concentration risk if one protocol suffers an exploit or liquidity event.' },
  { label: 'Min Allocation', value: '10%', description: 'Every active protocol keeps at least 10%. Positions stay warm for rapid reallocation without cold-start friction.' },
  { label: 'Idle Reserve', value: '5%', description: 'A cash buffer held uninvested. Small withdrawals are serviced instantly from the reserve without requiring protocol withdrawal transactions.' },
  { label: 'Rebalance Cooldown', value: '30 min', description: 'Minimum time between consecutive rebalances. Prevents thrashing when rates spike temporarily and then normalize.' },
  { label: 'Per-Cycle Move Cap', value: '30% TVL', description: 'Maximum capital moved in a single rebalance. Limits slippage and market impact for large vaults.' },
  { label: 'Compound Threshold', value: '10 EURC', description: 'Minimum accrued interest before auto-compounding triggers. Avoids wasting gas on dust amounts.' },
  { label: 'Rate Staleness', value: '10 min', description: 'Rates older than 10 minutes are marked stale and excluded from rebalance decisions.' },
] as const;

const RISK_PARAMS = [
  { label: 'Circuit Breaker', value: '2% drawdown', description: 'If TVL drops 2% from peak, the circuit breaker trips — all rebalancing and compounding halt immediately. Capital stays in current positions until manual review.' },
  { label: 'Max Utilization', value: '85%', description: 'The bot avoids supplying to protocols where utilization exceeds 85%. High utilization means withdrawal liquidity could be temporarily unavailable.' },
  { label: 'Oracle Sanity', value: '50% deviation', description: 'Rates that deviate more than 50% from the 7-day rolling average are rejected as outliers. Prevents acting on manipulated or erroneous rate data.' },
  { label: 'Health Score', value: '0–100', description: 'Composite risk metric: 50% drawdown distance + 30% concentration risk + 20% utilization warnings. Visible on the dashboard in real-time.' },
] as const;

const FEE_WATERFALL = [
  { label: 'Protocol gross rate', value: '~1.0%', color: 'text-foreground', note: 'What Drift/Kamino/Save pay suppliers' },
  { label: 'Spread capture (arbitrage)', value: '+0.2–0.5%', color: 'text-emerald-400', note: 'Additional yield from routing to highest-rate protocol' },
  { label: 'Auto-compounding', value: '+0.05%', color: 'text-emerald-400', note: 'Hourly reinvestment converts interest to principal' },
  { label: 'Management fee', value: '−0.5%', color: 'text-red-400', note: 'Annual fee on TVL for bot infrastructure' },
  { label: 'Performance fee', value: '−10% of profit', color: 'text-red-400', note: 'Applied on positive PnL only (high-water mark)' },
] as const;

// ─── Components ─────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: typeof TrendingUp; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ParamRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-3 border-b border-border last:border-0">
      <div className="sm:w-40 shrink-0">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-2 text-sm font-bold text-primary tabular-nums">{value}</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DocsPage() {
  usePageTitle('How It Works');
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Vault
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">How It Works</h1>
          <p className="mt-2 text-base text-muted-foreground max-w-2xl">
            A complete guide to how the EURC Yield Optimizer generates yield, manages fees,
            and protects your capital across three Solana lending protocols.
          </p>
        </div>

        <div className="space-y-8">

          {/* ─── Yield Generation ─────────────────────────────────────── */}
          <Section title="How APY Is Generated" icon={TrendingUp}>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              The vault earns yield by depositing EURC into lending protocols where borrowers pay interest
              to suppliers. The bot captures additional yield through <strong className="text-foreground">rate arbitrage</strong> — continuously
              moving capital to whichever protocol offers the highest rate.
            </p>

            {/* Protocol cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {(['drift', 'kamino', 'save'] as const).map((p) => (
                <div
                  key={p}
                  className="rounded-xl border border-border p-4"
                  style={{ borderColor: `${PROTOCOL_META[p].color}30` }}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <ProtocolIcon protocol={p} size={22} />
                    <span className="text-sm font-semibold text-foreground">{PROTOCOL_META[p].label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {p === 'drift' && 'Spot market lending. Borrowers use EURC as margin for leveraged positions. Rates spike during volatile markets.'}
                    {p === 'kamino' && 'Algorithmic liquidity optimizer. kLend reserves adjust rates via utilization curves. Often competitive with protocol incentives.'}
                    {p === 'save' && 'Solend-based lending protocol. Established reserve model with deep EURC liquidity and stable baseline rates.'}
                  </p>
                </div>
              ))}
            </div>

            {/* The flow */}
            <h3 className="text-sm font-semibold text-foreground mb-3">The Optimization Loop</h3>
            <div className="space-y-3">
              {[
                { step: '1', title: 'Rate Monitoring', desc: 'Every 5 minutes, the bot fetches live EURC supply rates from all three protocols via their REST APIs.', icon: Clock },
                { step: '2', title: 'Spread Detection', desc: 'If the gap between the best and worst rate exceeds 50 basis points, a rebalance opportunity is flagged.', icon: ArrowRightLeft },
                { step: '3', title: 'Capital Rebalancing', desc: 'The bot withdraws from the lowest-rate protocol and deposits into the highest, respecting allocation limits.', icon: Layers },
                { step: '4', title: 'Auto-Compounding', desc: 'Every hour, accrued interest (≥10 EURC) is harvested and reinvested into the best-rate protocol.', icon: Zap },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── Rate Evidence ─────────────────────────────────────────── */}
          <Section title="Rate Spread Evidence" icon={ArrowRightLeft}>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              The strategy thesis is built on a verifiable fact: EURC lending rates <strong className="text-foreground">diverge significantly</strong> across
              protocols. This creates persistent arbitrage opportunities that the bot captures automatically.
            </p>

            <div className="rounded-xl border border-border bg-secondary/10 p-5 mb-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Observed Rate Ranges (EURC Supply APY)</h3>
              <div className="space-y-3">
                {[
                  { protocol: 'Drift', min: '0.88%', max: '3.62%', avg: '2.22%', color: PROTOCOL_META.drift.color, note: '90 data points, highest variability' },
                  { protocol: 'Kamino', min: '0.30%', max: '0.33%', avg: '0.32%', color: PROTOCOL_META.kamino.color, note: '168 data points, most stable' },
                  { protocol: 'Save', min: '0.20%', max: '0.25%', avg: '0.23%', color: PROTOCOL_META.save.color, note: 'Lowest baseline, spikes during demand events' },
                ].map((row) => (
                  <div key={row.protocol} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-sm font-medium text-foreground">{row.protocol}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="text-muted-foreground">min <span className="text-foreground font-medium">{row.min}</span></span>
                      <span className="text-muted-foreground">max <span className="text-foreground font-medium">{row.max}</span></span>
                      <span className="text-muted-foreground">avg <span style={{ color: row.color }} className="font-semibold">{row.avg}</span></span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Data from protocol REST APIs. Drift shows the widest rate range (0.88-3.62%), creating spreads of 190+ bps
                vs Kamino — well above the 50 bps rebalance threshold.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs text-muted-foreground mb-1">Current Spread (Drift vs Save)</p>
                <p className="text-xl font-bold text-emerald-400 tabular-nums">~190 bps</p>
                <p className="text-[11px] text-muted-foreground mt-1">Above 50 bps rebalance threshold</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground mb-1">Rate Arbitrage Opportunity</p>
                <p className="text-xl font-bold text-primary tabular-nums">+1.9%</p>
                <p className="text-[11px] text-muted-foreground mt-1">Additional yield from optimal routing</p>
              </div>
            </div>
          </Section>

          {/* ─── Fee Structure ────────────────────────────────────────── */}
          <Section title="Fee Structure" icon={Percent}>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Two fees are charged by the vault. Both are assessed on-chain by the Voltr protocol —
              there are no hidden fees, withdrawal penalties, or lock-up periods.
            </p>

            {/* Fee cards */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-secondary/20 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Management Fee</h3>
                  <span className="text-lg font-bold text-primary tabular-nums">0.5%</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Annual fee charged on total vault TVL. Accrues continuously and is deducted from the
                  vault&apos;s asset balance — reducing the pbEURC exchange rate growth by 0.5% annually.
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  Covers: RPC node costs, Firebase infrastructure, bot compute, monitoring, and alerting.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Performance Fee</h3>
                  <span className="text-lg font-bold text-primary tabular-nums">10%</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Charged on profits only — 10% of positive PnL above the high-water mark.
                  Never charged when recovering from drawdowns.
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  Incentivizes: active strategy management, continuous rate optimization, and infrastructure uptime.
                </p>
              </div>
            </div>

            {/* Fee waterfall */}
            <h3 className="text-sm font-semibold text-foreground mb-3">Fee Waterfall (Example)</h3>
            <div className="rounded-xl border border-border bg-secondary/10 p-4">
              {FEE_WATERFALL.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <span className="text-sm text-foreground">{row.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{row.note}</span>
                  </div>
                  <span className={clsx('text-sm font-bold tabular-nums', row.color)}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
                <span className="text-sm font-semibold text-foreground">Net to depositor</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">Variable (see live rates)</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              All fees are assessed on-chain by the Voltr vault contract. There are no hidden charges,
              entry fees, exit fees, or lock-up penalties. Withdrawals are available anytime
              (subject to a 24-hour cooldown period for large withdrawals).
            </p>
          </Section>

          {/* ─── pbEURC Token Model ───────────────────────────────────── */}
          <Section title="pbEURC Token Model" icon={Zap}>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              When you deposit EURC, you receive <strong className="text-foreground">pbEURC</strong> — yield-bearing
              receipt tokens. Your yield is embedded in the growing exchange rate.
              No claiming, no staking, no manual compounding.
            </p>

            {/* Exchange rate visual */}
            <div className="rounded-xl border border-border bg-secondary/10 p-5 mb-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Exchange Rate Growth</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Day 1 (Deposit)</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">1.0000</p>
                  <p className="text-xs text-muted-foreground mt-1">1 EURC = 1 pbEURC</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Month 3</p>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">1.0025</p>
                  <p className="text-xs text-muted-foreground mt-1">+0.25% yield accrued</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Year 1</p>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">1.0100</p>
                  <p className="text-xs text-muted-foreground mt-1">+1.0% yield accrued</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-4 text-center">
                Exchange rate is illustrative. Actual growth depends on protocol rates and vault performance.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-sm mt-0.5">+</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Deposit:</strong> Your EURC is converted to pbEURC at the current exchange rate. The rate starts at 1:1 and only goes up.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-sm mt-0.5">+</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Yield accrual:</strong> As the vault earns interest, total EURC grows while pbEURC supply stays fixed → exchange rate increases.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-sm mt-0.5">+</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Withdraw:</strong> Burn pbEURC at the current (higher) exchange rate → receive more EURC than you deposited.</p>
              </div>
            </div>
          </Section>

          {/* ─── Strategy Parameters ──────────────────────────────────── */}
          <Section title="Strategy Parameters" icon={ArrowRightLeft}>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Every parameter is deliberately chosen to balance yield capture against operational risk.
              Try adjusting them in the <Link href="/simulator" className="text-primary hover:underline">Strategy Simulator</Link> to
              see how they affect projected returns.
            </p>
            <div>
              {STRATEGY_PARAMS.map((p) => (
                <ParamRow key={p.label} {...p} />
              ))}
            </div>
          </Section>

          {/* ─── Risk Management ──────────────────────────────────────── */}
          <Section title="Risk Management" icon={Shield}>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Capital protection is not an afterthought — it&apos;s built into every layer of the system.
              The vault uses four independent safety mechanisms.
            </p>
            <div>
              {RISK_PARAMS.map((p) => (
                <ParamRow key={p.label} {...p} />
              ))}
            </div>

            {/* Risk disclaimer */}
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-4">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300">Risk Disclaimer</p>
                <p className="mt-1 text-xs text-yellow-400/80 leading-relaxed">
                  This vault interacts with third-party DeFi protocols on Solana. Smart contract risk,
                  oracle risk, and liquidity risk cannot be fully eliminated. The circuit breaker and
                  diversification limits reduce but do not eliminate the possibility of loss.
                  Only deposit what you can afford to lose.
                </p>
              </div>
            </div>
          </Section>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/deposit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Deposit EURC
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Try the Simulator
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
