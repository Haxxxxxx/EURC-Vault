'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { formatEurcDisplay, formatTimestamp, truncateAddress } from '@/lib/utils';
import { EURC_DECIMALS, TRANSACTION_TYPES, TRANSACTION_STATUS } from '@/lib/constants';
import { ExternalLink, ArrowDownLeft, ArrowUpRight, Gift, Clock, XCircle } from 'lucide-react';

interface Transaction {
  id: string;
  type: keyof typeof TRANSACTION_TYPES;
  amount: number;
  timestamp: number;
  status: keyof typeof TRANSACTION_STATUS;
  signature: string;
  vaultName: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'DEPOSIT',
    amount: 25000 * Math.pow(10, EURC_DECIMALS),
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    status: 'CONFIRMED',
    signature: '5j7s8K9mN2pQ3rT4uV5wX6yZ7A8B9C0D1E2F3G4H5',
    vaultName: 'Standard Vault',
  },
  {
    id: '2',
    type: 'REWARD_CLAIM',
    amount: 125.5 * Math.pow(10, EURC_DECIMALS),
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    status: 'CONFIRMED',
    signature: '3K4L5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z9A0B1C2D3',
    vaultName: 'Premium Vault',
  },
  {
    id: '3',
    type: 'COOLDOWN_STARTED',
    amount: 10000 * Math.pow(10, EURC_DECIMALS),
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    status: 'CONFIRMED',
    signature: '7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7',
    vaultName: 'Standard Vault',
  },
  {
    id: '4',
    type: 'WITHDRAW',
    amount: 5000 * Math.pow(10, EURC_DECIMALS),
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    status: 'CONFIRMED',
    signature: '1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1',
    vaultName: 'Premium Vault',
  },
  {
    id: '5',
    type: 'DEPOSIT',
    amount: 50000 * Math.pow(10, EURC_DECIMALS),
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
    status: 'CONFIRMED',
    signature: '9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9',
    vaultName: 'Enterprise Vault',
  },
];

const TRANSACTION_ICONS = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAW: ArrowUpRight,
  REWARD_CLAIM: Gift,
  COOLDOWN_STARTED: Clock,
  COOLDOWN_CANCELLED: XCircle,
};

const TRANSACTION_LABELS = {
  DEPOSIT: 'Deposit',
  WITHDRAW: 'Withdrawal',
  REWARD_CLAIM: 'Reward Claim',
  COOLDOWN_STARTED: 'Cooldown Started',
  COOLDOWN_CANCELLED: 'Cooldown Cancelled',
};

export function TransactionTable() {
  const [filter, setFilter] = useState<string>('all');

  const filteredTransactions = filter === 'all'
    ? MOCK_TRANSACTIONS
    : MOCK_TRANSACTIONS.filter((tx) => TRANSACTION_TYPES[tx.type] === filter);

  return (
    <GlassCard padding="none">
      <div className="p-6 border-b border-glass-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-foreground">Transaction History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter(TRANSACTION_TYPES.DEPOSIT)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === TRANSACTION_TYPES.DEPOSIT
                  ? 'bg-primary text-white'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Deposits
            </button>
            <button
              onClick={() => setFilter(TRANSACTION_TYPES.WITHDRAW)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === TRANSACTION_TYPES.WITHDRAW
                  ? 'bg-primary text-white'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Withdrawals
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-glass-border">
              <th className="px-6 py-4 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Vault
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx, index) => {
              const Icon = TRANSACTION_ICONS[tx.type];
              const isPositive = tx.type === 'DEPOSIT' || tx.type === 'REWARD_CLAIM';

              return (
                <tr
                  key={tx.id}
                  className={`${
                    index !== filteredTransactions.length - 1 ? 'border-b border-glass-border' : ''
                  } hover:bg-white/5 transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isPositive ? 'bg-success/10' : 'bg-foreground-secondary/10'
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          isPositive ? 'text-success' : 'text-foreground-secondary'
                        }`} />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {TRANSACTION_LABELS[tx.type]}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-light text-foreground-secondary">
                      {tx.vaultName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-medium ${
                      isPositive ? 'text-success' : 'text-foreground'
                    }`}>
                      {isPositive ? '+' : ''}{formatEurcDisplay(tx.amount, EURC_DECIMALS)} EURC
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-light text-foreground-secondary">
                      {formatTimestamp(tx.timestamp)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={tx.status === 'CONFIRMED' ? 'success' : 'warning'}>
                      {tx.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-light text-primary hover:text-primary-hover transition-colors"
                    >
                      {truncateAddress(tx.signature, 6, 6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
