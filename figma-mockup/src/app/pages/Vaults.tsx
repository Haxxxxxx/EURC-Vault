import { GlassCard } from '../components/GlassCard';
import { Lock, TrendUp, WarningCircle } from '@phosphor-icons/react';
import { Link } from 'react-router';

const vaults = [
  {
    id: 'main-stability',
    name: 'Main EURC Stability Vault',
    apy: 8.45,
    tvl: 6500000,
    capacity: 10000000,
    risk: 'Low',
    status: 'active',
  },
  {
    id: 'high-yield',
    name: 'High Yield EURC Pool',
    apy: 12.8,
    tvl: 3200000,
    capacity: 5000000,
    risk: 'Medium',
    status: 'active',
  },
  {
    id: 'premium-locked',
    name: 'Premium Locked Staking',
    apy: 15.5,
    tvl: 1800000,
    capacity: 3000000,
    risk: 'Medium',
    status: 'active',
  },
  {
    id: 'conservative',
    name: 'Conservative Reserve Vault',
    apy: 5.2,
    tvl: 8900000,
    capacity: 15000000,
    risk: 'Very Low',
    status: 'active',
  },
];

export function Vaults() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light mb-2">Available Vaults</h1>
          <p className="text-muted-foreground">Choose a vault that matches your risk profile</p>
        </div>
        <GlassCard className="px-6 py-3">
          <div className="text-sm text-muted-foreground">Total Value Locked</div>
          <div className="text-2xl font-light">€20.4M</div>
        </GlassCard>
      </div>

      <div className="grid gap-6">
        {vaults.map((vault) => {
          const percentFilled = (vault.tvl / vault.capacity) * 100;
          
          return (
            <GlassCard key={vault.name} className="p-6 hover:shadow-2xl transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-1">{vault.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded-full ${
                        vault.risk === 'Very Low' ? 'bg-accent/20 text-accent' :
                        vault.risk === 'Low' ? 'bg-chart-3/20 text-[var(--chart-3)]' :
                        'bg-chart-4/20 text-[var(--chart-4)]'
                      }`}>
                        {vault.risk} Risk
                      </span>
                      <span>•</span>
                      <span>TVL: €{(vault.tvl / 1000000).toFixed(1)}M</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">APY</div>
                  <div className="text-4xl font-light text-accent">
                    {vault.apy}<span className="text-2xl">%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">
                    {percentFilled.toFixed(1)}% filled
                  </span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${percentFilled}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link 
                  to={`/deposit-withdraw/${vault.id}`}
                  className="flex-1 h-10 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center"
                >
                  Stake Now
                </Link>
                <Link
                  to={`/vaults/${vault.id}`}
                  className="px-6 h-10 border border-border rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center"
                >
                  Details
                </Link>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <WarningCircle className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium mb-1">Important Information</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All vaults are secured by smart contracts audited by leading security firms. 
              Rewards are calculated and distributed automatically at the end of each epoch. 
              Please review the risk profile and terms before staking your EURC.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}