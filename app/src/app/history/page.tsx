'use client';

import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { TransactionTable } from '@/components/history/TransactionTable';
import { TransactionVolumeChart } from '@/components/charts/TransactionVolumeChart';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { FadeIn } from '@/components/motion/FadeIn';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { EURC_DECIMALS } from '@/lib/constants';
import {
  ClockCounterClockwise,
  ArrowCircleDown,
  ArrowCircleUp,
} from '@phosphor-icons/react';

export default function HistoryPage() {
  const { connected } = useWallet();
  const { transactions, loading, hasMore, loadMore } = useTransactionHistory();

  const stats = useMemo(() => {
    let totalDeposits = 0;
    let depositCount = 0;
    let totalWithdrawals = 0;
    let withdrawCount = 0;

    for (const tx of transactions) {
      if (tx.type === 'DEPOSIT') {
        totalDeposits += tx.amount;
        depositCount++;
      } else if (tx.type === 'WITHDRAW') {
        totalWithdrawals += tx.amount;
        withdrawCount++;
      }
    }

    return {
      totalDeposits: totalDeposits / Math.pow(10, EURC_DECIMALS),
      depositCount,
      totalWithdrawals: totalWithdrawals / Math.pow(10, EURC_DECIMALS),
      withdrawCount,
    };
  }, [transactions]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ClockCounterClockwise className="w-8 h-8 text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-medium text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-foreground-secondary font-light mb-6">
            Connect your wallet to view your transaction history
          </p>
        </GlassCard>
      </div>
    );
  }

  if (loading && transactions.length === 0) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <div>
            <Skeleton width="260px" height="36px" rounded="lg" />
            <Skeleton width="400px" height="20px" rounded="lg" className="mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} height="120px" rounded="lg" />
            ))}
          </div>
          <Skeleton height="300px" rounded="lg" />
          <Skeleton height="400px" rounded="lg" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light text-foreground mb-2">Transaction History</h1>
          <p className="text-foreground-secondary font-light">
            View all your deposits and withdrawals across all vaults
          </p>
        </div>

        {/* 3-col Stats */}
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StaggerItem>
            <GlassCard padding="md">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-primary/20">
                  <ArrowCircleDown className="w-5 h-5 text-primary" weight="duotone" />
                </div>
                <span className="text-sm font-light text-foreground-secondary">Total Deposits</span>
              </div>
              <p className="text-3xl font-light text-foreground">
                <AnimatedNumber value={stats.totalDeposits} decimals={2} suffix=" EURC" />
              </p>
              <p className="text-xs font-light text-foreground-secondary mt-1">
                {stats.depositCount} transaction{stats.depositCount !== 1 ? 's' : ''}
              </p>
            </GlassCard>
          </StaggerItem>

          <StaggerItem>
            <GlassCard padding="md">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-foreground-secondary/20">
                  <ArrowCircleUp className="w-5 h-5 text-foreground-secondary" weight="duotone" />
                </div>
                <span className="text-sm font-light text-foreground-secondary">Total Withdrawals</span>
              </div>
              <p className="text-3xl font-light text-foreground">
                <AnimatedNumber value={stats.totalWithdrawals} decimals={2} suffix=" EURC" />
              </p>
              <p className="text-xs font-light text-foreground-secondary mt-1">
                {stats.withdrawCount} transaction{stats.withdrawCount !== 1 ? 's' : ''}
              </p>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>

        {/* Transaction Volume Chart */}
        <FadeIn>
          <GlassCard padding="md" className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Weekly Volume</h3>
            <TransactionVolumeChart weeks={12} />
          </GlassCard>
        </FadeIn>

        {/* Transaction Table */}
        <FadeIn delay={0.1}>
          <TransactionTable transactions={transactions} />
        </FadeIn>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              size="sm"
              loading={loading}
              onClick={loadMore}
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
