import { GlassCard } from './GlassCard';
import { Lock, ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router';

export function VaultCard() {
  const totalCapacity = 10000000;
  const currentlyStaked = 6500000;
  const percentFilled = (currentlyStaked / totalCapacity) * 100;
  const apy = 8.45;
  const userStaked = 25000;
  const userEarnings = 1234.50;

  return (
    <GlassCard className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-medium mb-2">Main EURC Stability Vault</h2>
              <p className="text-muted-foreground">Earn competitive returns on your EURC holdings</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Current APY</div>
            <div className="text-4xl font-light tracking-tight text-accent">
              {apy}<span className="text-2xl">%</span>
            </div>
          </div>
        </div>

        {/* User Position */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-muted/50 rounded-xl">
            <div className="text-sm text-muted-foreground mb-1">Your Stake</div>
            <div className="text-2xl font-light">{userStaked.toLocaleString()} EURC</div>
          </div>
          <div className="p-5 bg-accent/10 rounded-xl border border-accent/20">
            <div className="text-sm text-muted-foreground mb-1">Total Earned</div>
            <div className="text-2xl font-light text-accent">+{userEarnings.toLocaleString()} EURC</div>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vault Capacity</span>
            <span className="font-medium">
              {currentlyStaked.toLocaleString()} / {totalCapacity.toLocaleString()} EURC
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${percentFilled}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-accent font-medium">{percentFilled.toFixed(1)}% Filled</span>
            <span className="text-muted-foreground">
              {(totalCapacity - currentlyStaked).toLocaleString()} EURC Remaining
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            to="/deposit-withdraw/main-stability"
            className="flex-1 h-12 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
          >
            Manage Stake
            <ArrowRight className="w-4 h-4" weight="bold" />
          </Link>
          <Link
            to="/vaults/main-stability"
            className="px-6 h-12 border border-border rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center"
          >
            View Details
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}