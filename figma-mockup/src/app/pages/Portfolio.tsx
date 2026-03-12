import { GlassCard } from '../components/GlassCard';
import { VaultCard } from '../components/VaultCard';
import { EpochTimeline } from '../components/EpochTimeline';
import { PortfolioChart } from '../components/PortfolioChart';
import { TrendUp, CurrencyEur } from '@phosphor-icons/react';

export function Portfolio() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Portfolio Overview Hero */}
      <GlassCard className="p-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm text-muted-foreground mb-3 tracking-wide uppercase">Total Balance</h2>
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-6xl font-light tracking-tight">105,234.50</span>
              <span className="text-3xl text-muted-foreground font-light">EURC</span>
            </div>
            <div className="flex items-center gap-2 text-accent">
              <TrendUp className="w-4 h-4" />
              <span className="text-sm font-medium">+8.2% this month</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">USD Equivalent</div>
            <div className="text-2xl font-light">$112,351.19</div>
          </div>
        </div>
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <CurrencyEur className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Total Staked</span>
          </div>
          <div className="text-3xl font-light">65,234.50</div>
          <div className="text-sm text-muted-foreground mt-1">EURC in vaults</div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <TrendUp className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-muted-foreground">Total Earned</span>
          </div>
          <div className="text-3xl font-light text-accent">4,567.30</div>
          <div className="text-sm text-muted-foreground mt-1">Lifetime rewards</div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center">
              <CurrencyEur className="w-5 h-5 text-[var(--chart-3)]" />
            </div>
            <span className="text-sm text-muted-foreground">Available</span>
          </div>
          <div className="text-3xl font-light">40,000.00</div>
          <div className="text-sm text-muted-foreground mt-1">Ready to stake</div>
        </GlassCard>
      </div>

      {/* Portfolio Chart */}
      <PortfolioChart />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VaultCard />
        </div>
        <div>
          <EpochTimeline />
        </div>
      </div>
    </div>
  );
}