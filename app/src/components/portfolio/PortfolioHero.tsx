'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { formatEurcDisplay } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { TrendingUp, Wallet, Award } from 'lucide-react';

interface PortfolioHeroProps {
  totalStaked: number;
  totalRewards: number;
  activeVaults: number;
}

export function PortfolioHero({ totalStaked, totalRewards, activeVaults }: PortfolioHeroProps) {
  const totalStakedFormatted = parseFloat(formatEurcDisplay(totalStaked, EURC_DECIMALS));
  const totalRewardsFormatted = parseFloat(formatEurcDisplay(totalRewards, EURC_DECIMALS));

  return (
    <GlassCard padding="lg" className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-foreground-secondary" />
            <span className="text-sm font-light text-foreground-secondary">
              Total Portfolio Value
            </span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <AnimatedNumber
              value={totalStakedFormatted}
              decimals={2}
              prefix="€"
              className="text-6xl font-extralight text-foreground tracking-tight"
            />
            <span className="text-2xl font-light text-foreground-secondary">EURC</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 text-success">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                +{totalRewardsFormatted.toFixed(2)} EURC
              </span>
            </div>
            <span className="text-sm font-light text-foreground-secondary">
              total rewards earned
            </span>
          </div>
        </div>

        <div className="lg:border-l lg:border-glass-border lg:pl-8">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-foreground-secondary" />
                <span className="text-sm font-light text-foreground-secondary">
                  Rewards Earned
                </span>
              </div>
              <AnimatedNumber
                value={totalRewardsFormatted}
                decimals={2}
                prefix="€"
                className="text-3xl font-light text-success"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-foreground-secondary" />
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
