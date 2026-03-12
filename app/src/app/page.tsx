'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { useUserPortfolio } from '@/hooks/useUserStake';
import { useVaults } from '@/hooks/useVault';
import { useEpochCountdown } from '@/hooks/useEpochCountdown';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useVaultAllocation } from '@/hooks/useChartData';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EpochTimeline } from '@/components/vault/EpochTimeline';
import { CapacityBar } from '@/components/vault/CapacityBar';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { FadeIn } from '@/components/motion/FadeIn';
import { formatPercentage } from '@/lib/utils';
import { EURC_MINT, VAULT_REGISTRY } from '@/lib/constants';
import { CurrencyEur, Wallet, WarningCircle, Vault } from '@phosphor-icons/react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ActivePositionsList } from '@/components/portfolio/ActivePositionsList';
import Link from 'next/link';

// Lazy-load chart components to reduce initial bundle size
const PortfolioChart = dynamic(() => import('@/components/charts/PortfolioChart').then(m => ({ default: m.PortfolioChart })), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-card/50" />,
});

const PortfolioSparkline = dynamic(() => import('@/components/charts/PortfolioSparkline').then(m => ({ default: m.PortfolioSparkline })), {
  ssr: false,
  loading: () => <div className="h-[60px] animate-pulse rounded-lg bg-card/50" />,
});

const VaultAllocationChart = dynamic(() => import('@/components/charts/VaultAllocationChart').then(m => ({ default: m.VaultAllocationChart })), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-card/50" />,
});

export default function HomePage() {
  const { connected } = useWallet();
  const { portfolio, loading: portfolioLoading } = useUserPortfolio();
  const { vaults, loading: vaultsLoading } = useVaults();
  const { balance: eurcBalance } = useTokenBalance(EURC_MINT);
  const mainVault = vaults[0] || null;
  const { epochNumber } = useEpochCountdown(mainVault?.slug);

  // Build vault name map from registry
  const vaultNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of VAULT_REGISTRY) {
      map[v.slug] = v.name;
    }
    return map;
  }, []);

  // Build allocation data from portfolio positions
  const allocationStakes = useMemo(() => {
    if (!portfolio?.positions.length) return [];
    return portfolio.positions.map((s) => ({
      vaultId: s.slug,
      stakedAmount: s.positionValueEurc,
    }));
  }, [portfolio]);

  const allocationData = useVaultAllocation(allocationStakes, vaultNames);

  // USD equivalent (1 EURC ~ 1.067 USD)
  const totalPositionValue = portfolio?.totalPositionValue ?? 0;
  const totalBalance = totalPositionValue + eurcBalance;
  const usdEquivalent = useMemo(() => (totalBalance / 1e6) * 1.067, [totalBalance]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-primary" weight="duotone" />
          </div>
          <h2 className="text-3xl font-light text-foreground mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-foreground-secondary font-light mb-2 text-lg">
            Connect your Solana wallet to view your portfolio and start earning yield on EURC
          </p>
          <p className="text-sm text-foreground-secondary/60 font-light">
            Supports Phantom, Solflare, and other Solana wallets
          </p>
        </GlassCard>
      </div>
    );
  }

  if (portfolioLoading || vaultsLoading) {
    return (
      <div className="space-y-8">
        <Skeleton height="280px" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="120px" />
          ))}
        </div>
        <Skeleton height="340px" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton height="400px" />
          </div>
          <Skeleton height="400px" />
        </div>
      </div>
    );
  }

  const anyLive = vaults.some((v) => v.isLive);

  // Get user's position in the main vault
  const mainStake = portfolio?.positions.find((s) => s.slug === mainVault?.slug);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Mock data banner */}
        {!anyLive && vaults.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20">
            <WarningCircle className="w-5 h-5 text-warning flex-shrink-0" weight="bold" />
            <p className="text-sm font-light text-foreground-secondary">
              Showing demo data — the on-chain program is not deployed yet.
            </p>
          </div>
        )}

        {/* Hero Section */}
        <GlassCard padding="lg">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CurrencyEur className="w-5 h-5 text-foreground-secondary" weight="bold" />
                <span className="text-sm font-light text-foreground-secondary uppercase tracking-wider">
                  Total Balance
                </span>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-6xl font-light text-foreground tracking-tight">
                  <AnimatedNumber value={totalBalance / 1e6} decimals={2} />
                </span>
                <span className="text-3xl font-light text-foreground-secondary">EURC</span>
              </div>
              {/* Sparkline */}
              {totalBalance > 0 && (
                <div className="mt-4">
                  <PortfolioSparkline days={30} baseValue={totalBalance / 1e6} height={60} />
                </div>
              )}
            </div>

            {/* USD Equivalent */}
            <div className="text-right hidden md:block">
              <p className="text-sm font-light text-foreground-secondary mb-1">USD Equivalent</p>
              <p className="text-3xl font-light text-foreground">
                $<AnimatedNumber value={usdEquivalent} decimals={2} />
              </p>
            </div>
          </div>
        </GlassCard>

        {/* 3-col Stats Grid */}
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StaggerItem>
            <GlassCard padding="md">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-primary/20">
                  <CurrencyEur className="w-5 h-5 text-primary" weight="bold" />
                </div>
                <span className="text-sm font-light text-foreground-secondary">Position Value</span>
              </div>
              <p className="text-3xl font-light text-foreground">
                <AnimatedNumber value={totalPositionValue / 1e6} decimals={2} />
              </p>
              <p className="text-sm font-light text-foreground-secondary mt-1">EURC</p>
            </GlassCard>
          </StaggerItem>

          <StaggerItem>
            <GlassCard padding="md">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-success/20">
                  <Vault className="w-5 h-5 text-success" weight="duotone" />
                </div>
                <span className="text-sm font-light text-foreground-secondary">Active Vaults</span>
              </div>
              <p className="text-3xl font-light text-foreground">
                {portfolio?.activeVaults ?? 0}
              </p>
              <p className="text-sm font-light text-foreground-secondary mt-1">positions</p>
            </GlassCard>
          </StaggerItem>

          <StaggerItem>
            <GlassCard padding="md">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-chart-3/20">
                  <Wallet className="w-5 h-5 text-[var(--chart-3)]" weight="duotone" />
                </div>
                <span className="text-sm font-light text-foreground-secondary">Available</span>
              </div>
              <p className="text-3xl font-light text-foreground">
                <AnimatedNumber value={eurcBalance / 1e6} decimals={2} />
              </p>
              <p className="text-sm font-light text-foreground-secondary mt-1">EURC</p>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>

        {/* Active Positions */}
        {totalPositionValue > 0 && <ActivePositionsList />}

        {/* Empty state when user hasn't staked yet */}
        {totalPositionValue === 0 && (
          <EmptyState
            icon={<Vault className="w-8 h-8 text-primary" weight="duotone" />}
            title="Start Earning Yield"
            description="You haven't deposited any EURC yet. Deposit into a vault to start earning yield through the pbEURC receipt token model."
            actionLabel="Browse Vaults"
            actionHref="/vaults"
          />
        )}

        {/* Portfolio Chart */}
        {totalPositionValue > 0 && <PortfolioChart />}

        {/* 2/3 + 1/3 Grid: VaultCard Summary + Allocation + Epoch Timeline */}
        <StaggerGrid className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vault Summary Card - 2/3 */}
          <StaggerItem className="lg:col-span-2">
            <GlassCard padding="lg" className="h-full">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-medium text-foreground mb-1">
                    {mainVault ? mainVault.name : 'Main EURC Stability Vault'}
                  </h3>
                  <p className="text-sm font-light text-foreground-secondary">
                    {mainVault ? mainVault.description : 'Low-risk, steady returns with 7-day withdrawal period'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-extralight text-foreground">
                    {mainVault ? formatPercentage(mainVault.apy, 1) : '8.45%'}
                  </span>
                  <p className="text-sm font-light text-foreground-secondary">APY</p>
                </div>
              </div>

              {/* User Position */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-xl bg-glass border border-glass-border">
                  <p className="text-xs font-light text-foreground-secondary mb-1">Your Shares</p>
                  <p className="text-lg font-medium text-foreground">
                    <AnimatedNumber value={mainStake ? mainStake.pbEurcBalance / 1e6 : 0} decimals={2} />
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-glass border border-glass-border">
                  <p className="text-xs font-light text-foreground-secondary mb-1">Position Value</p>
                  <p className="text-lg font-medium text-foreground">
                    <AnimatedNumber value={mainStake ? mainStake.positionValueEurc / 1e6 : 0} decimals={2} />
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-glass border border-glass-border">
                  <p className="text-xs font-light text-foreground-secondary mb-1">Exchange Rate</p>
                  <p className="text-lg font-medium text-foreground">
                    {mainStake ? mainStake.exchangeRate.toFixed(4) : '1.0000'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-glass border border-glass-border">
                  <p className="text-xs font-light text-foreground-secondary mb-1">Epoch</p>
                  <p className="text-lg font-medium text-foreground">#{epochNumber}</p>
                </div>
              </div>

              {/* Capacity Bar */}
              {mainVault && (
                <CapacityBar tvl={mainVault.tvl} capacity={mainVault.capacity} className="mb-6" />
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Link
                  href={mainVault ? `/deposit-withdraw/${mainVault.slug}` : '/vaults'}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-primary to-primary-hover shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Deposit EURC
                </Link>
                <Link
                  href={mainVault ? `/vaults/${mainVault.slug}` : '/vaults'}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-foreground bg-glass border border-glass-border hover:bg-white/10 backdrop-blur-glass transition-all duration-200"
                >
                  Manage Position
                </Link>
              </div>
            </GlassCard>
          </StaggerItem>

          {/* Right column: Allocation + Epoch */}
          <StaggerItem>
            <div className="space-y-6 h-full flex flex-col">
              {/* Vault Allocation Chart */}
              {allocationData.length > 0 && (
                <FadeIn>
                  <GlassCard padding="lg">
                    <h3 className="text-lg font-medium text-foreground mb-4">Vault Allocation</h3>
                    <VaultAllocationChart data={allocationData} />
                  </GlassCard>
                </FadeIn>
              )}

              {/* Epoch Timeline */}
              <GlassCard padding="lg" className="flex-1">
                <h3 className="text-lg font-medium text-foreground mb-6">Epoch Timeline</h3>
                <EpochTimeline />
              </GlassCard>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </div>
    </PageTransition>
  );
}
