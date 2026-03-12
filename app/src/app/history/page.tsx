'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { TransactionTable } from '@/components/history/TransactionTable';
import { GlassCard } from '@/components/ui/GlassCard';
import { History } from 'lucide-react';

export default function HistoryPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-medium text-foreground mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-foreground-secondary font-light mb-6">
            Connect your wallet to view your transaction history
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-foreground mb-2">Transaction History</h1>
        <p className="text-foreground-secondary font-light">
          View all your deposits, withdrawals, and reward claims
        </p>
      </div>

      <TransactionTable />
    </div>
  );
}
