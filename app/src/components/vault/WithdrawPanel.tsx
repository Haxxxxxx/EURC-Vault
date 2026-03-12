'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { formatEurcDisplay, formatTimestamp } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { Clock, AlertCircle } from 'lucide-react';

interface WithdrawPanelProps {
  stakedAmount: number;
  cooldownStartTime: number | null;
  cooldownEndTime: number | null;
  cooldownDuration: number;
  onWithdraw: (amount: number) => void;
  onStartCooldown: () => void;
  onCancelCooldown: () => void;
}

export function WithdrawPanel({
  stakedAmount,
  cooldownStartTime,
  cooldownEndTime,
  cooldownDuration,
  onWithdraw,
  onStartCooldown,
  onCancelCooldown,
}: WithdrawPanelProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const hasCooldown = cooldownStartTime !== null && cooldownEndTime !== null;
  const cooldownComplete = hasCooldown && Date.now() >= cooldownEndTime!;

  const handleMaxClick = () => {
    setAmount(formatEurcDisplay(stakedAmount, EURC_DECIMALS));
  };

  const handleStartCooldown = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onStartCooldown();
    setLoading(false);
  };

  const handleCancelCooldown = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onCancelCooldown();
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!amount || !cooldownComplete) return;

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onWithdraw(numericAmount * Math.pow(10, EURC_DECIMALS));
    setAmount('');
    setLoading(false);
  };

  const canWithdraw = numericAmount > 0 && numericAmount * Math.pow(10, EURC_DECIMALS) <= stakedAmount && cooldownComplete;

  return (
    <div className="space-y-6">
      {hasCooldown && (
        <GlassCard padding="md">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${cooldownComplete ? 'bg-success/10' : 'bg-warning/10'}`}>
              <Clock className={`w-5 h-5 ${cooldownComplete ? 'text-success' : 'text-warning'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-medium text-foreground">
                  Withdrawal Cooldown
                </h4>
                <Badge variant={cooldownComplete ? 'success' : 'warning'}>
                  {cooldownComplete ? 'Ready' : 'In Progress'}
                </Badge>
              </div>
              <p className="text-sm font-light text-foreground-secondary mb-3">
                {cooldownComplete
                  ? 'Your withdrawal is ready to be processed.'
                  : `Withdrawal will be available after ${formatTimestamp(cooldownEndTime!)}`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelCooldown}
                loading={loading}
              >
                Cancel Cooldown
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {!hasCooldown && (
        <GlassCard padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-foreground mb-1">
                Withdrawal Period
              </h4>
              <p className="text-sm font-light text-foreground-secondary">
                Withdrawals require a {Math.floor(cooldownDuration / (24 * 60 * 60))}-day cooldown period.
                You'll earn rewards during this time.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div>
        <Input
          type="number"
          label="Withdrawal Amount"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={hasCooldown && !cooldownComplete}
          rightElement={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              disabled={hasCooldown && !cooldownComplete}
              className="!py-1 !px-2 text-xs"
            >
              MAX
            </Button>
          }
        />
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="font-light text-foreground-secondary">
            Staked: {formatEurcDisplay(stakedAmount, EURC_DECIMALS)} EURC
          </span>
        </div>
      </div>

      {hasCooldown && cooldownComplete ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canWithdraw}
          loading={loading}
          onClick={handleWithdraw}
        >
          Withdraw EURC
        </Button>
      ) : !hasCooldown ? (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          loading={loading}
          onClick={handleStartCooldown}
        >
          Start Cooldown Period
        </Button>
      ) : (
        <Button variant="secondary" size="lg" fullWidth disabled>
          Cooldown in Progress
        </Button>
      )}
    </div>
  );
}
