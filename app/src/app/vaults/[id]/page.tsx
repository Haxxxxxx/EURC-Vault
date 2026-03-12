'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useVault } from '@/hooks/useVault';
import { useEpochHistory } from '@/hooks/useEpochHistory';
import { DepositWithdrawModal } from '@/components/vault/DepositWithdrawModal';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { FadeIn } from '@/components/motion/FadeIn';
import { ApyHistoryChart } from '@/components/charts/ApyHistoryChart';
import { TvlGrowthChart } from '@/components/charts/TvlGrowthChart';
import { formatEurcDisplay } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  CurrencyEur,
  Users,
  Clock,
  TrendUp,
  WarningCircle,

  Lightning,
} from '@phosphor-icons/react';

interface VaultDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VaultDetailPage({ params }: VaultDetailPageProps) {
  const { id } = use(params);
  const { vault, loading } = useVault(id);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const { epochs: epochHistory } = useEpochHistory(id);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton height="40px" className="w-32" />
        <Skeleton height="300px" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="320px" />
          <Skeleton height="320px" />
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <h2 className="text-2xl font-medium text-foreground mb-2">Vault Not Found</h2>
          <p className="text-foreground-secondary font-light mb-4">
            The requested vault could not be found.
          </p>
          <Link
            href="/vaults"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" weight="bold" />
            Back to Vaults
          </Link>
        </GlassCard>
      </div>
    );
  }

  // Transform epoch history for chart components when real data exists
  const apyData =
    epochHistory.length > 0
      ? epochHistory.map((e) => ({
          epoch: e.epochNumber,
          apy: e.apy,
        }))
      : undefined;

  const tvlData =
    epochHistory.length > 0
      ? epochHistory.map((e) => ({
          date: new Date(e.endTime * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          tvl: e.totalEurcInVault,
          stakers: 0,
        }))
      : undefined;

  const filled = vault.capacity > 0 ? (vault.tvl / vault.capacity) * 100 : 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href="/vaults"
          className="inline-flex items-center gap-2 text-sm font-light text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" />
          Back to Vaults
        </Link>

        {/* Pause banner */}
        {vault.paused && (
          <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-center">
            <Badge variant="error">Vault Paused</Badge>
            <p className="text-sm mt-1 text-foreground-secondary">Deposits are disabled. Withdrawals and emergency exit remain available.</p>
          </div>
        )}

        {/* Demo data banner */}
        {!vault.isLive && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20">
            <WarningCircle className="w-5 h-5 text-warning flex-shrink-0" weight="bold" />
            <p className="text-sm font-light text-foreground-secondary">
              Showing demo data — this vault is not deployed on-chain yet.
            </p>
          </div>
        )}

        {/* Hero Card */}
        <GlassCard padding="lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-8 h-8 text-primary" weight="duotone" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-light text-foreground">{vault.name}</h1>
                  <Badge variant={vault.riskVariant}>{vault.risk} Risk</Badge>
                </div>
                <p className="text-foreground-secondary font-light max-w-2xl">
                  {vault.description}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extralight text-success">
                  <AnimatedNumber value={vault.apy} decimals={1} suffix="%" />
                </span>
              </div>
              <p className="text-sm font-light text-foreground-secondary mt-1">Annual APY</p>
            </div>
          </div>

          {/* 4-col Stats */}
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StaggerItem>
              <div className="p-4 rounded-xl bg-glass border border-glass-border">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyEur className="w-4 h-4 text-foreground-secondary" weight="bold" />
                  <span className="text-xs font-light text-foreground-secondary">Total Value Locked</span>
                </div>
                <p className="text-xl font-medium text-foreground">
                  <AnimatedNumber value={vault.tvl / 1e6} decimals={2} suffix=" EURC" />
                </p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="p-4 rounded-xl bg-glass border border-glass-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-foreground-secondary" weight="bold" />
                  <span className="text-xs font-light text-foreground-secondary">Lock Period</span>
                </div>
                <p className="text-xl font-medium text-foreground">{vault.lockPeriodLabel}</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="p-4 rounded-xl bg-glass border border-glass-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendUp className="w-4 h-4 text-foreground-secondary" weight="bold" />
                  <span className="text-xs font-light text-foreground-secondary">Min Deposit</span>
                </div>
                <p className="text-xl font-medium text-foreground">{vault.minDepositLabel}</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="p-4 rounded-xl bg-glass border border-glass-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-foreground-secondary" weight="bold" />
                  <span className="text-xs font-light text-foreground-secondary">Active Stakers</span>
                </div>
                <p className="text-xl font-medium text-foreground">
                  <AnimatedNumber value={vault.stakerCount} decimals={0} />
                </p>
              </div>
            </StaggerItem>
          </StaggerGrid>
        </GlassCard>

        {/* 2-col Chart Grid */}
        <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* APY History */}
          <StaggerItem>
            <GlassCard padding="lg">
              <h3 className="text-lg font-medium text-foreground mb-4">APY History</h3>
              <FadeIn delay={0.2}>
                <ApyHistoryChart baseApy={vault.apy} data={apyData} />
              </FadeIn>
            </GlassCard>
          </StaggerItem>

          {/* TVL Growth */}
          <StaggerItem>
            <GlassCard padding="lg">
              <h3 className="text-lg font-medium text-foreground mb-4">TVL Growth</h3>
              <FadeIn delay={0.2}>
                <TvlGrowthChart baseTvl={vault.tvl} data={tvlData} />
              </FadeIn>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>

        {/* 3-col Info Cards */}
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Security */}
          <StaggerItem>
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" weight="duotone" />
                </div>
                <h3 className="font-medium text-foreground">Security</h3>
              </div>
              <ul className="space-y-2 text-sm text-foreground-secondary">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Audited by CertiK & Trail of Bits
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Multi-sig wallet protection
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Insurance coverage available
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Emergency withdrawal always available — bypass pause &amp; cooldown
                </li>
              </ul>
            </GlassCard>
          </StaggerItem>

          {/* How Yield Works */}
          <StaggerItem>
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <TrendUp className="w-5 h-5 text-accent" weight="duotone" />
                </div>
                <h3 className="font-medium text-foreground">How Yield Works</h3>
              </div>
              <ul className="space-y-2 text-sm text-foreground-secondary">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Yield accrues automatically via pbEURC exchange rate
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  No claiming needed — your shares grow in value
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Exchange rate increases when rewards are funded
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Withdraw anytime to realize your yield
                </li>
              </ul>
            </GlassCard>
          </StaggerItem>

          {/* Community */}
          <StaggerItem>
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[var(--chart-3)]" weight="duotone" />
                </div>
                <h3 className="font-medium text-foreground">Community</h3>
              </div>
              <ul className="space-y-2 text-sm text-foreground-secondary">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <AnimatedNumber value={vault.stakerCount} decimals={0} /> active stakers
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Average stake: {vault.stakerCount > 0 ? formatEurcDisplay(Math.round(vault.tvl / vault.stakerCount), EURC_DECIMALS) : '0'} EURC
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Join our Discord community
                </li>
              </ul>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>

        {/* Capacity Bar */}
        <GlassCard padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">Vault Capacity</h3>
            <span className="text-sm font-light text-foreground-secondary">
              {filled.toFixed(0)}% filled
            </span>
          </div>
          <div className="relative h-3 bg-glass rounded-full overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-success rounded-full transition-all duration-700 shadow-glow"
              style={{ width: `${Math.min(filled, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm font-light text-foreground-secondary">
            <span>{formatEurcDisplay(vault.tvl, EURC_DECIMALS)} EURC deposited</span>
            <span>{formatEurcDisplay(vault.capacity, EURC_DECIMALS)} EURC capacity</span>
          </div>
          {filled >= 100 && (
            <p className="text-xs text-warning mt-2">Deposits are currently blocked — vault at full capacity</p>
          )}
        </GlassCard>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDepositModal(true)}
            className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-xl text-lg font-medium text-white bg-gradient-to-r from-primary to-accent shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Lightning className="w-5 h-5" weight="bold" />
            Deposit EURC
          </button>
          <Link
            href={`/deposit-withdraw/${vault.slug}`}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-medium text-foreground bg-glass border border-glass-border backdrop-blur-glass hover:bg-white/10 transition-all duration-200"
          >
            Advanced View
          </Link>
        </div>

        {/* Inline Deposit Modal */}
        <DepositWithdrawModal
          vault={vault}
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
        />
      </div>
    </PageTransition>
  );
}
