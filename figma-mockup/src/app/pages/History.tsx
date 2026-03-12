import { GlassCard } from '../components/GlassCard';
import { ArrowCircleDown, ArrowCircleUp, TrendUp } from '@phosphor-icons/react';

const transactions = [
  {
    id: 1,
    type: 'deposit',
    amount: 5000,
    vault: 'Main EURC Stability Vault',
    date: '2026-02-08 14:32',
    txHash: '0x1a2b...3c4d',
    status: 'completed',
  },
  {
    id: 2,
    type: 'reward',
    amount: 42.15,
    vault: 'Main EURC Stability Vault',
    date: '2026-02-05 00:00',
    txHash: '0x5e6f...7g8h',
    status: 'completed',
  },
  {
    id: 3,
    type: 'deposit',
    amount: 10000,
    vault: 'High Yield EURC Pool',
    date: '2026-02-01 09:15',
    txHash: '0x9i0j...1k2l',
    status: 'completed',
  },
  {
    id: 4,
    type: 'withdraw',
    amount: 2500,
    vault: 'Main EURC Stability Vault',
    date: '2026-01-28 16:45',
    txHash: '0x3m4n...5o6p',
    status: 'completed',
  },
  {
    id: 5,
    type: 'reward',
    amount: 38.72,
    vault: 'High Yield EURC Pool',
    date: '2026-01-25 00:00',
    txHash: '0x7q8r...9s0t',
    status: 'completed',
  },
  {
    id: 6,
    type: 'deposit',
    amount: 15000,
    vault: 'Premium Locked Staking',
    date: '2026-01-20 11:20',
    txHash: '0xuv1w...2x3y',
    status: 'completed',
  },
];

export function History() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-light mb-2">Transaction History</h1>
        <p className="text-muted-foreground">View all your staking activities and rewards</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Deposits</div>
          <div className="text-3xl font-light mb-1">€65,234</div>
          <div className="text-sm text-accent flex items-center gap-1">
            <ArrowCircleDown className="w-4 h-4" />
            12 transactions
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Withdrawals</div>
          <div className="text-3xl font-light mb-1">€8,450</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowCircleUp className="w-4 h-4" />
            3 transactions
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Rewards</div>
          <div className="text-3xl font-light text-accent mb-1">€4,567</div>
          <div className="text-sm text-accent flex items-center gap-1">
            <TrendUp className="w-4 h-4" />
            28 epochs
          </div>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Vault</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Transaction</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.type === 'deposit' && (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <ArrowCircleDown className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">Deposit</span>
                        </>
                      )}
                      {tx.type === 'withdraw' && (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <ArrowCircleUp className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">Withdraw</span>
                        </>
                      )}
                      {tx.type === 'reward' && (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                            <TrendUp className="w-4 h-4 text-accent" />
                          </div>
                          <span className="font-medium">Reward</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{tx.vault}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${
                      tx.type === 'reward' ? 'text-accent' :
                      tx.type === 'withdraw' ? 'text-muted-foreground' :
                      'text-foreground'
                    }`}>
                      {tx.type === 'withdraw' ? '-' : '+'}{tx.amount.toLocaleString()} EURC
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{tx.date}</td>
                  <td className="px-6 py-4">
                    <a 
                      href={`https://etherscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline font-mono"
                    >
                      {tx.txHash}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-xs rounded-full bg-accent/20 text-accent">
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}