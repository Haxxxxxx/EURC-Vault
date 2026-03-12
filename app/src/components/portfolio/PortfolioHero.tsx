'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { formatEurcDisplay } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { TrendUp, Wallet } from '@phosphor-icons/react';
import { PortfolioSparkline } from '@/components/charts/PortfolioSparkline';

interface PortfolioHeroProps {
  totalPositionValue: number;
  activeVaults: number;
}

export function PortfolioHero({ totalPositionValue, activeVaults }: PortfolioHeroProps) {
  const totalPositionFormatted = parseFloat(formatEurcDisplay(totalPositionValue, EURC_DECIMALS));

  return (
    <GlassCard padding="lg" className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-foreground-secondary" weight="bold" />
            <span className="text-sm font-light text-foreground-secondary">
              Total Portfolio Value
            </span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <AnimatedNumber
              value={totalPositionFormatted}
              decimals={2}
              prefix="€"
              className="text-6xl font-extralight text-foreground tracking-tight"
            />
            <span className="text-2xl font-light text-foreground-secondary">EURC</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 text-foreground-secondary">
              <TrendUp className="w-4 h-4" weight="bold" />
              <span className="text-sm font-medium">
                Yield embedded in position value
              </span>
            </div>
          </div>
          <div className="mt-4">
            <PortfolioSparkline
              days={30}
              baseValue={totalPositionFormatted || 60000}
              height={80}
            />
          </div>
        </div>

        <div className="lg:border-l lg:border-glass-border lg:pl-8">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendUp className="w-4 h-4 text-foreground-secondary" weight="bold" />
                <span className="text-sm font-light text-foreground-secondary">
                  Active Vaults
                </span>
              </div>
              <p className="text-3xl font-light text-foreground">{activeVaults}</p>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
