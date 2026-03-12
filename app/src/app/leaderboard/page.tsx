'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Users,
  Gift,
  Link as LinkIcon,
  Copy,
} from '@phosphor-icons/react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useUserPoints } from '@/hooks/useUserPoints';

const tiers = [
  {
    name: 'Bronze',
    multiplier: 'x1.0',
    range: '0 - 10K',
    gradient: 'from-amber-700/20 to-amber-900/10',
    border: 'border-amber-700/30',
    text: 'text-amber-600',
  },
  {
    name: 'Silver',
    multiplier: 'x1.2',
    range: '10K - 25K',
    gradient: 'from-chart-3/20 to-chart-3/5',
    border: 'border-chart-3/30',
    text: 'text-chart-3',
  },
  {
    name: 'Gold',
    multiplier: 'x1.5',
    range: '25K - 50K',
    gradient: 'from-accent/20 to-accent/5',
    border: 'border-accent/30',
    text: 'text-accent',
  },
  {
    name: 'Diamond',
    multiplier: 'x2.0',
    range: '50K+',
    gradient: 'from-primary/20 to-accent/10',
    border: 'border-primary/30',
    text: 'text-primary',
  },
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
        <Crown className="w-5 h-5 text-white" weight="fill" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
        <Medal className="w-5 h-5 text-white" weight="fill" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
        <Medal className="w-5 h-5 text-white" weight="fill" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
      <span className="text-sm font-medium text-foreground">#{rank}</span>
    </div>
  );
}

function LiveDot({ isLive }: { isLive: boolean }) {
  if (!isLive) return null;
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"
      title="Live data from Firebase"
    />
  );
}

export default function LeaderboardPage() {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const { entries: leaderboardEntries, loading: lbLoading, isLive: lbLive } = useLeaderboard(10);
  const userPoints = useUserPoints();

  const referralCode = userPoints.referralCode || 'EURC-XXXX';
  const referralLink = `https://eurc-vault.io/ref/${referralCode}`;
  const referralPointsEarned = userPoints.referralCount * 500;
  // Estimate monthly commission: ~34 EURC per active referral (10% of avg earnings)
  const estimatedCommission = Math.round(userPoints.referralCount * 34);

  const handleCopy = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light text-foreground mb-2">
            Leaderboard & Rewards
          </h1>
          <p className="text-foreground-secondary font-light">
            Earn points, climb the leaderboard, and unlock exclusive rewards
          </p>
        </div>

        {/* User Stats Hero */}
        <GlassCard padding="lg">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Trophy className="w-8 h-8 text-white" weight="fill" />
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 text-center md:text-left">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-light text-foreground-secondary">Your Rank</p>
                  <LiveDot isLive={userPoints.isLive} />
                </div>
                {userPoints.loading ? (
                  <Skeleton width="80px" height="36px" rounded="lg" />
                ) : (
                  <p className="text-3xl font-light text-foreground">
                    {userPoints.rank > 0 ? `#${userPoints.rank}` : '--'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-light text-foreground-secondary mb-1">Total Points</p>
                {userPoints.loading ? (
                  <Skeleton width="100px" height="36px" rounded="lg" />
                ) : (
                  <p className="text-3xl font-light text-accent">
                    {userPoints.totalPoints.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* How to Earn Points */}
        <div>
          <h2 className="text-2xl font-light text-foreground mb-6">How to Earn Points</h2>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Staking */}
            <StaggerItem>
              <GlassCard padding="md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Star className="w-5 h-5 text-primary" weight="fill" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Staking</h3>
                </div>
                <p className="text-sm font-light text-foreground-secondary mb-4">
                  1 point per 100 EURC staked per day
                </p>
                <div className="rounded-xl bg-muted/60 p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">1,000 EURC/day</span>
                    <span className="text-foreground font-medium">= 10 pts/day</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">10,000 EURC/day</span>
                    <span className="text-foreground font-medium">= 100 pts/day</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">50,000 EURC/day</span>
                    <span className="text-foreground font-medium">= 500 pts/day</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>

            {/* Referral */}
            <StaggerItem>
              <GlassCard padding="md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <Users className="w-5 h-5 text-accent" weight="fill" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Referral</h3>
                </div>
                <p className="text-sm font-light text-foreground-secondary mb-4">
                  500 points per active referral + 10% lifetime commission on their earnings
                </p>
                <div className="rounded-xl bg-muted/60 p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">1 active referral</span>
                    <span className="text-foreground font-medium">= 500 pts</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">5 active referrals</span>
                    <span className="text-foreground font-medium">= 2,500 pts</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">Lifetime commission</span>
                    <span className="text-accent font-medium">10%</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>

            {/* Multipliers */}
            <StaggerItem>
              <GlassCard padding="md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <Gift className="w-5 h-5 text-warning" weight="fill" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Multipliers</h3>
                </div>
                <p className="text-sm font-light text-foreground-secondary mb-4">
                  Multiplier tiers based on the staked amount
                </p>
                <div className="rounded-xl bg-muted/60 p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">Bronze (0 - 10K)</span>
                    <span className="text-foreground font-medium">x1.0</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">Silver (10K - 25K)</span>
                    <span className="text-foreground font-medium">x1.2</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">Gold (25K - 50K)</span>
                    <span className="text-accent font-medium">x1.5</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-secondary">Diamond (50K+)</span>
                    <span className="text-primary font-medium">x2.0</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>
          </StaggerGrid>
        </div>

        {/* Point Multiplier Tiers */}
        <div>
          <h2 className="text-2xl font-light text-foreground mb-6">Multiplier Tiers</h2>
          <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <StaggerItem key={tier.name}>
                <GlassCard padding="md" className={`bg-gradient-to-br ${tier.gradient} ${tier.border}`}>
                  <p className={`text-3xl font-light ${tier.text} mb-1`}>{tier.multiplier}</p>
                  <p className="text-base font-medium text-foreground mb-1">{tier.name}</p>
                  <p className="text-xs text-foreground-secondary">{tier.range} EURC</p>
                </GlassCard>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {/* Referral Program */}
        <div>
          <h2 className="text-2xl font-light text-foreground mb-6">Referral Program</h2>
          <GlassCard padding="lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Referral Code & Link */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-light text-foreground-secondary mb-2">Your Referral Code</p>
                  {userPoints.loading ? (
                    <Skeleton width="100%" height="48px" rounded="lg" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-xl bg-muted/60 px-4 py-3 font-mono text-lg text-foreground tracking-wider">
                        {referralCode}
                      </div>
                      <button
                        onClick={() => handleCopy(referralCode, 'code')}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      >
                        <Copy className="w-5 h-5" weight={copied === 'code' ? 'fill' : 'regular'} />
                        <span className="text-xs font-medium">Copy</span>
                      </button>
                    </div>
                  )}
                  {copied === 'code' && (
                    <p className="text-xs text-accent mt-1">Code copied!</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-light text-foreground-secondary mb-2">Referral Link</p>
                  {userPoints.loading ? (
                    <Skeleton width="100%" height="48px" rounded="lg" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-xl bg-muted/60 px-4 py-3 text-sm text-foreground-secondary truncate">
                        {referralLink}
                      </div>
                      <button
                        onClick={() => handleCopy(referralLink, 'link')}
                        className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      >
                        <LinkIcon className="w-5 h-5" weight={copied === 'link' ? 'fill' : 'regular'} />
                      </button>
                    </div>
                  )}
                  {copied === 'link' && (
                    <p className="text-xs text-accent mt-1">Link copied!</p>
                  )}
                </div>
              </div>

              {/* Referral Stats */}
              <div className="space-y-4">
                {userPoints.loading ? (
                  <Skeleton width="100%" height="80px" rounded="lg" />
                ) : (
                  <div className="grid grid-cols-3 gap-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 p-4">
                    <div className="text-center">
                      <p className="text-2xl font-light text-foreground">{userPoints.referralCount}</p>
                      <p className="text-xs text-foreground-secondary">Active Referrals</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-light text-accent">{referralPointsEarned.toLocaleString()}</p>
                      <p className="text-xs text-foreground-secondary">Points Earned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-light text-foreground">+{estimatedCommission}</p>
                      <p className="text-xs text-foreground-secondary">EURC/mo commission</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-accent" weight="fill" />
                    <p className="text-sm font-medium text-foreground">Referral Bonus</p>
                  </div>
                  <p className="text-xs font-light text-foreground-secondary">
                    Invite 10 active friends and unlock Ambassador status: permanent x2.5 multiplier + 15% lifetime commission.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Top 10 Leaderboard Table */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-light text-foreground">Top 10 Leaderboard</h2>
            <LiveDot isLive={lbLive} />
          </div>
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider px-6 py-4">
                      Rank
                    </th>
                    <th className="text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider px-6 py-4">
                      Address
                    </th>
                    <th className="text-right text-xs font-medium text-foreground-secondary uppercase tracking-wider px-6 py-4">
                      Points
                    </th>
                    <th className="text-right text-xs font-medium text-foreground-secondary uppercase tracking-wider px-6 py-4">
                      EURC Staked
                    </th>
                    <th className="text-right text-xs font-medium text-foreground-secondary uppercase tracking-wider px-6 py-4">
                      Referrals
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lbLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-6 py-4"><Skeleton width="40px" height="40px" rounded="lg" /></td>
                          <td className="px-6 py-4"><Skeleton width="120px" height="20px" rounded="md" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton width="70px" height="20px" rounded="md" className="ml-auto" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton width="90px" height="20px" rounded="md" className="ml-auto" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton width="40px" height="20px" rounded="md" className="ml-auto" /></td>
                        </tr>
                      ))
                    : leaderboardEntries.map((entry) => (
                        <tr
                          key={entry.rank}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center w-8">
                              <RankIcon rank={entry.rank} />
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-foreground">
                            {entry.address}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-accent">
                            {entry.points.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-foreground">
                            {entry.staked.toLocaleString()} EURC
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-foreground-secondary">
                            <div className="flex items-center justify-end gap-1.5">
                              <Users className="w-4 h-4 text-foreground-secondary" />
                              <span>{entry.referrals}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
          <p className="text-xs font-light text-foreground-secondary mt-3 pl-1">
            Ranks 4-10 receive descending bonuses from 1,000 to 200 EUR
          </p>
        </div>

        {/* Monthly Rewards */}
        <div>
          <h2 className="text-2xl font-light text-foreground mb-6">Monthly Rewards</h2>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1st Place */}
            <StaggerItem>
              <GlassCard padding="lg" className="bg-gradient-to-br from-yellow-500/15 to-yellow-700/5 border-yellow-500/30 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Crown className="w-8 h-8 text-yellow-500/30" weight="fill" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-6 h-6 text-yellow-500" weight="fill" />
                  <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">1st Place</span>
                </div>
                <p className="text-3xl font-light text-foreground mb-4">5,000 EUR</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Star className="w-4 h-4 text-yellow-500" weight="fill" />
                    <span>+2% bonus APY</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Gift className="w-4 h-4 text-yellow-500" weight="fill" />
                    <span>Exclusive Champion NFT</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>

            {/* 2nd Place */}
            <StaggerItem>
              <GlassCard padding="lg" className="bg-gradient-to-br from-gray-300/15 to-gray-500/5 border-gray-400/30 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Medal className="w-8 h-8 text-gray-400/30" weight="fill" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Medal className="w-6 h-6 text-gray-400" weight="fill" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-300">2nd Place</span>
                </div>
                <p className="text-3xl font-light text-foreground mb-4">3,000 EUR</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Star className="w-4 h-4 text-gray-400" weight="fill" />
                    <span>+1.5% bonus APY</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Gift className="w-4 h-4 text-gray-400" weight="fill" />
                    <span>Exclusive Elite NFT</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>

            {/* 3rd Place */}
            <StaggerItem>
              <GlassCard padding="lg" className="bg-gradient-to-br from-amber-600/15 to-amber-800/5 border-amber-600/30 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Medal className="w-8 h-8 text-amber-600/30" weight="fill" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Medal className="w-6 h-6 text-amber-600" weight="fill" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">3rd Place</span>
                </div>
                <p className="text-3xl font-light text-foreground mb-4">1,500 EUR</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Star className="w-4 h-4 text-amber-600" weight="fill" />
                    <span>+1% bonus APY</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Gift className="w-4 h-4 text-amber-600" weight="fill" />
                    <span>Exclusive Veteran NFT</span>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>
          </StaggerGrid>
        </div>
      </div>
    </PageTransition>
  );
}
