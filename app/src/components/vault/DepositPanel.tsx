'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { calculateProjectedEarnings, formatEurcDisplay } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { TrendingUp } from 'lucide-react';

interface DepositPanelProps {
  apy: number;
  minDeposit: number;
  maxDeposit: number;
  availableBalance: number;
  onDeposit: (amount: number) => void;
}

export function DepositPanel({
  apy,
  minDeposit,
  maxDeposit,
  availableBalance,
  onDeposit,
}: DepositPanelProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const projected = calculateProjectedEarnings(numericAmount, apy);

  const handleMaxClick = () => {
    const maxAmount = Math.min(availableBalance, maxDeposit);
    setAmount(formatEurcDisplay(maxAmount, EURC_DECIMALS));
  };

  const handleDeposit = async () => {
    if (!amount || numericAmount < minDeposit / Math.pow(10, EURC_DECIMALS)) {
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onDeposit(numericAmount * Math.pow(10, EURC_DECIMALS));
    setAmount('');
    setLoading(false);
  };

  const canDeposit =
    numericAmount >= minDeposit / Math.pow(10, EURC_DECIMALS) &&
    numericAmount <= maxDeposit / Math.pow(10, EURC_DECIMALS) &&
    numericAmount * Math.pow(10, EURC_DECIMALS) <= availableBalance;

  return (
    <div className="space-y-6">
      <div>
        <Input
          type="number"
          label="Deposit Amount"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          rightElement={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              className="!py-1 !px-2 text-xs"
            >
              MAX
            </Button>
          }
        />
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="font-light text-foreground-secondary">
            Available: {formatEurcDisplay(availableBalance, EURC_DECIMALS)} EURC
          </span>
          <span className="font-light text-foreground-secondary">
            Min: {formatEurcDisplay(minDeposit, EURC_DECIMALS)} EURC
          </span>
        </div>
      </div>

      {numericAmount > 0 && (
        <GlassCard padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-success/10">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-foreground mb-2">
                Projected Earnings
              </h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground-secondary">
                    Monthly
                  </span>
                  <span className="text-sm font-medium text-success">
                    +{projected.monthly.toFixed(2)} EURC
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-foreground-secondary">
                    Yearly
                  </span>
                  <span className="text-sm font-medium text-success">
                    +{projected.yearly.toFixed(2)} EURC
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canDeposit}
        loading={loading}
        onClick={handleDeposit}
      >
        Deposit EURC
      </Button>
    </div>
  );
}
