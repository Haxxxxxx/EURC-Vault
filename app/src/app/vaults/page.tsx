'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useVaults } from '@/hooks/useVault';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { Vault, TrendUp, WarningCircle, ShieldCheck, Users } from '@phosphor-icons/react';
import type { VaultData } from '@/hooks/useVault';

/* ------------------------------------------------------------------ */
/* Memoized vault card — prevents full-list re-render on single-vault  */
/* state changes                                                       */
/* ------------------------------------------------------------------ */

const VaultCard = React.memo(function VaultCard({ vault }: { vault: VaultData }) {
  const filled = vault.capacity > 0 ? (vault.tvl / vault.capacity) * 100 : 0;
  const tvlFormatted = formatEurcDisplay(vault.tvl, EURC_DECIMALS);

  return (
    <StaggerItem>
      <GlassCard padding="lg" hover>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: Icon + Info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Vault className="w-7 h-7 text-primary" weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-medium text-foreground">{vault.name}</h3>
                <Badge variant={vault.riskVariant}>{vault.risk} Risk</Badge>
                {vault.paused && <Badge variant="error">Paused</Badge>}
                {!vault.paused && vault.tvl >= vault.capacity && <Badge variant="warning">Full</Badge>}
              </div>
              <p className="text-sm font-light text-foreground-secondary line-clamp-1">
                {vault.description}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs font-light text-foreground-secondary">
                  TVL: {tvlFormatted} EURC
                </span>
                <span className="text-xs font-light text-foreground-secondary flex items-center gap-1">
                  <Users className="w-3 h-3" weight="bold" />
                  {vault.stakerCount.toLocaleString()} stakers
                </span>
                <span className="text-xs font-light text-foreground-secondary">
                  Lock: {vault.lockPeriodLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Center: APY */}
          <div className="flex items-center gap-6 lg:min-w-[180px]">
            <div className="text-center lg:text-right">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extralight text-success">
                  <AnimatedNumber value={vault.apy} decimals={1} suffix="%" />
                </span>
              </div>
              <p className="text-xs font-light text-foreground-secondary">APY</p>
            </div>
          </div>

          {/* Right: Capacity + Buttons */}
          <div className="lg:min-w-[280px] space-y-4">
            {/* Capacity Bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-light text-foreground-secondary">
                  {filled.toFixed(0)}% filled
                </span>
                <span className="text-xs font-light text-foreground-secondary">
                  {tvlFormatted} / {formatEurcDisplay(vault.capacity, EURC_DECIMALS)}
                </span>
              </div>
              <div className="relative h-2 bg-glass rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-success rounded-full transition-all duration-700 shadow-glow"
                  style={{ width: `${Math.min(filled, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-light text-foreground-secondary">
                  Min deposit: {vault.minDepositLabel}
                </span>
                <span className="text-xs font-light text-foreground-secondary">
                  Cooldown: {vault.lockPeriodLabel}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={`/deposit-withdraw/${vault.slug}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-accent shadow-md hover:shadow-lg transition-all duration-200"
              >
                <TrendUp className="w-4 h-4" weight="bold" />
                Stake Now
              </Link>
              <Link
                href={`/vaults/${vault.slug}`}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium text-foreground bg-glass border border-glass-border hover:bg-white/10 backdrop-blur-glass transition-all duration-200"
              >
                Details
              </Link>
            </div>
          </div>
        </div>
      </GlassCard>
    </StaggerItem>
  );
});

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export default function VaultsPage() {
  const { vaults, loading } = useVaults();

  const totalTvl = useMemo(() => vaults.reduce((sum, v) => sum + v.tvl, 0), [vaults]);
  const anyLive = useMemo(() => vaults.some((v) => v.isLive), [vaults]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton height="80px" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="160px" />
        ))}
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light text-foreground mb-2">Available Vaults</h1>
            <p className="text-foreground-secondary font-light">
              Choose a vault that matches your risk tolerance and return expectations
            </p>
          </div>

          {/* TVL Summary Card */}
          <GlassCard padding="md" className="md:min-w-[280px]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20">
                <Vault className="w-5 h-5 text-primary" weight="duotone" />
              </div>
              <div>
                <p className="text-xs font-light text-foreground-secondary">Total Value Locked</p>
                <p className="text-xl font-light text-foreground">
                  <AnimatedNumber value={totalTvl / 1e6} decimals={2} suffix=" EURC" />
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Mock data banner */}
        {!anyLive && vaults.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20">
            <WarningCircle className="w-5 h-5 text-warning flex-shrink-0" weight="bold" />
            <p className="text-sm font-light text-foreground-secondary">
              Showing demo data — the on-chain program is not deployed yet.
            </p>
          </div>
        )}

        {/* Vault Cards - Full Width */}
        <StaggerGrid className="space-y-4">
          {vaults.map((vault) => (
            <VaultCard key={vault.slug} vault={vault} />
          ))}
        </StaggerGrid>

        {/* Important Info Card */}
        <GlassCard padding="lg">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-warning/10 flex-shrink-0">
              <WarningCircle className="w-6 h-6 text-warning" weight="duotone" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground mb-2">Important Information</h3>
              <ul className="space-y-2 text-sm font-light text-foreground-secondary">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" weight="bold" />
                  Your deposit earns rewards pro-rata. Rewards are funded by vault authority and distributed based on your share of total deposits.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" weight="bold" />
                  Withdrawal cooldowns vary per vault. During cooldown, the withdrawn amount stops earning rewards.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" weight="bold" />
                  Emergency withdrawal is always available — bypasses cooldown and vault pause with no penalty.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" weight="bold" />
                  Deposits are blocked when a vault is paused or at full capacity.
                </li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
