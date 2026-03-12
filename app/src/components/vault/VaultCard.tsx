import Link from 'next/link';
import { VaultData } from '@/hooks/useVault';
import { GlassCard } from '@/components/ui/GlassCard';
import { CapacityBar } from './CapacityBar';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { TrendingUp, Users } from 'lucide-react';

interface VaultCardProps {
  vault: VaultData;
}

export function VaultCard({ vault }: VaultCardProps) {
  return (
    <Link href={`/vaults/${vault.id}`}>
      <GlassCard hover padding="lg" className="h-full">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-medium text-foreground mb-1">
                {vault.name}
              </h3>
              <p className="text-sm font-light text-foreground-secondary">
                {vault.description}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extralight text-foreground">
                {formatPercentage(vault.apy, 1)}
              </span>
              <span className="text-sm font-light text-foreground-secondary">
                APY
              </span>
            </div>
          </div>

          <CapacityBar tvl={vault.tvl} capacity={vault.capacity} className="mb-6" />

          <div className="mt-auto grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-foreground-secondary mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-light">Total Staked</span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {formatEurcDisplay(vault.tvl, EURC_DECIMALS)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-foreground-secondary mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-light">Stakers</span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {vault.stakerCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
