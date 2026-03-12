'use client';

import { useState, use } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVault } from '@/hooks/useVault';
import { useUserStake } from '@/hooks/useUserStake';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { CapacityBar } from '@/components/vault/CapacityBar';
import { DepositPanel } from '@/components/vault/DepositPanel';
import { WithdrawPanel } from '@/components/vault/WithdrawPanel';
import { EpochTimeline } from '@/components/vault/EpochTimeline';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { TrendingUp, Users, Percent, Wallet } from 'lucide-react';

interface VaultDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VaultDetailPage({ params }: VaultDetailPageProps) {
  const { id } = use(params);
  const { connected } = useWallet();
  const { vault, loading: vaultLoading } = useVault(id);
  const { stake, loading: stakeLoading } = useUserStake(id);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  const mockAvailableBalance = 100000 * Math.pow(10, EURC_DECIMALS);

  if (vaultLoading) {
    return (
      <div className="space-y-8">
        <Skeleton height="200px" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton height="500px" />
          </div>
          <Skeleton height="500px" />
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <h2 className="text-2xl font-medium text-foreground mb-2">Vault Not Found</h2>
          <p className="text-foreground-secondary font-light">
            The requested vault could not be found.
          </p>
        </GlassCard>
      </div>
    );
  }

  const handleDeposit = (amount: number) => {
    console.log('Deposit:', amount);
  };

  const handleWithdraw = (amount: number) => {
    console.log('Withdraw:', amount);
  };

  const handleStartCooldown = () => {
    console.log('Start cooldown');
  };

  const handleCancelCooldown = () => {
    console.log('Cancel cooldown');
  };

  return (
    <div className="space-y-8">
      <GlassCard padding="lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-light text-foreground">{vault.name}</h1>
              <Badge variant="info">Active</Badge>
            </div>
            <p className="text-foreground-secondary font-light">{vault.description}</p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-extralight text-foreground">
                {formatPercentage(vault.apy, 1)}
              </span>
            </div>
            <span className="text-sm font-light text-foreground-secondary">Annual APY</span>
          </div>
        </div>

        <CapacityBar tvl={vault.tvl} capacity={vault.capacity} className="mb-6" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-foreground-secondary" />
              <span className="text-sm font-light text-foreground-secondary">Total Staked</span>
            </div>
            <p className="text-xl font-medium text-foreground">
              {formatEurcDisplay(vault.tvl, EURC_DECIMALS)} EURC
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-foreground-secondary" />
              <span className="text-sm font-light text-foreground-secondary">Stakers</span>
            </div>
            <p className="text-xl font-medium text-foreground">
              {vault.stakerCount.toLocaleString()}
            </p>
          </div>

          {connected && stake && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-foreground-secondary" />
                  <span className="text-sm font-light text-foreground-secondary">Your Stake</span>
                </div>
                <p className="text-xl font-medium text-foreground">
                  {formatEurcDisplay(stake.stakedAmount, EURC_DECIMALS)} EURC
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-foreground-secondary" />
                  <span className="text-sm font-light text-foreground-secondary">Your Share</span>
                </div>
                <p className="text-xl font-medium text-foreground">
                  {formatPercentage(stake.sharePercentage)}
                </p>
              </div>
            </>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard padding="lg">
            <EpochTimeline />
          </GlassCard>

          {connected && (
            <GlassCard padding="none">
              <div className="border-b border-glass-border">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                      activeTab === 'deposit'
                        ? 'text-foreground'
                        : 'text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    Deposit
                    {activeTab === 'deposit' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('withdraw')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                      activeTab === 'withdraw'
                        ? 'text-foreground'
                        : 'text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    Withdraw
                    {activeTab === 'withdraw' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'deposit' ? (
                  <DepositPanel
                    apy={vault.apy}
                    minDeposit={vault.minDeposit}
                    maxDeposit={vault.maxDeposit}
                    availableBalance={mockAvailableBalance}
                    onDeposit={handleDeposit}
                  />
                ) : (
                  <WithdrawPanel
                    stakedAmount={stake?.stakedAmount || 0}
                    cooldownStartTime={stake?.cooldownStartTime || null}
                    cooldownEndTime={stake?.cooldownEndTime || null}
                    cooldownDuration={vault.withdrawalCooldown}
                    onWithdraw={handleWithdraw}
                    onStartCooldown={handleStartCooldown}
                    onCancelCooldown={handleCancelCooldown}
                  />
                )}
              </div>
            </GlassCard>
          )}
        </div>

        <div className="space-y-6">
          <GlassCard padding="md">
            <h3 className="text-lg font-medium text-foreground mb-4">Vault Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-light text-foreground-secondary">Min Deposit</span>
                <span className="text-sm font-medium text-foreground">
                  {formatEurcDisplay(vault.minDeposit, EURC_DECIMALS)} EURC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-light text-foreground-secondary">Max Deposit</span>
                <span className="text-sm font-medium text-foreground">
                  {formatEurcDisplay(vault.maxDeposit, EURC_DECIMALS)} EURC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-light text-foreground-secondary">Cooldown Period</span>
                <span className="text-sm font-medium text-foreground">
                  {Math.floor(vault.withdrawalCooldown / (24 * 60 * 60))} days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-light text-foreground-secondary">Reward Rate</span>
                <span className="text-sm font-medium text-success">
                  {formatPercentage(vault.rewardRate, 4)}/day
                </span>
              </div>
            </div>
          </GlassCard>

          {connected && stake && (
            <GlassCard padding="md">
              <h3 className="text-lg font-medium text-foreground mb-4">Your Position</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground-secondary">Staked Amount</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatEurcDisplay(stake.stakedAmount, EURC_DECIMALS)} EURC
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground-secondary">Rewards Earned</span>
                  <span className="text-sm font-medium text-success">
                    +{formatEurcDisplay(stake.rewardsEarned, EURC_DECIMALS)} EURC
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground-secondary">Pool Share</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPercentage(stake.sharePercentage)}
                  </span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
