'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useUserPortfolio } from '@/hooks/useUserStake';
import { useVaults } from '@/hooks/useVault';
import { PortfolioHero } from '@/components/portfolio/PortfolioHero';
import { VaultCard } from '@/components/vault/VaultCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { TrendingUp, Wallet, Award, Activity } from 'lucide-react';
import { useEpochCountdown } from '@/hooks/useEpochCountdown';

export default function HomePage() {
  const { connected } = useWallet();
  const { portfolio, loading: portfolioLoading } = useUserPortfolio();
  const { vaults, loading: vaultsLoading } = useVaults();
  const { epochNumber } = useEpochCountdown();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-medium text-foreground mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-foreground-secondary font-light mb-6">
            Connect your Solana wallet to view your portfolio and start staking EURC
          </p>
        </GlassCard>
      </div>
    );
  }

  if (portfolioLoading) {
    return (
      <div className="space-y-8">
        <Skeleton height="200px" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="120px" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="300px" />
          ))}
        </div>
      </div>
    );
  }

  const totalStaked = portfolio?.totalStaked || 0;
  const totalRewards = portfolio?.totalRewards || 0;
  const activeVaults = portfolio?.activeVaults || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-foreground mb-2">Portfolio Overview</h1>
        <p className="text-foreground-secondary font-light">
          Monitor your staking positions and earnings across all vaults
        </p>
      </div>

      <PortfolioHero
        totalStaked={totalStaked}
        totalRewards={totalRewards}
        activeVaults={activeVaults}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-light text-foreground-secondary">
              Total Staked
            </span>
          </div>
          <p className="text-2xl font-light text-foreground">
            €{(totalStaked / Math.pow(10, 6)).toFixed(2)}
          </p>
        </GlassCard>

        <GlassCard padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-success/10">
              <Award className="w-5 h-5 text-success" />
            </div>
            <span className="text-sm font-light text-foreground-secondary">
              Rewards Earned
            </span>
          </div>
          <p className="text-2xl font-light text-success">
            €{(totalRewards / Math.pow(10, 6)).toFixed(2)}
          </p>
        </GlassCard>

        <GlassCard padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-warning/10">
              <Activity className="w-5 h-5 text-warning" />
            </div>
            <span className="text-sm font-light text-foreground-secondary">
              Active Vaults
            </span>
          </div>
          <p className="text-2xl font-light text-foreground">{activeVaults}</p>
        </GlassCard>

        <GlassCard padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-light text-foreground-secondary">
              Current Epoch
            </span>
          </div>
          <p className="text-2xl font-light text-foreground">#{epochNumber}</p>
        </GlassCard>
      </div>

      <div>
        <h2 className="text-2xl font-light text-foreground mb-6">Available Vaults</h2>
        {vaultsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="300px" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
