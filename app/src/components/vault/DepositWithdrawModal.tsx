'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useUserStake } from '@/hooks/useUserStake';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useDeposit } from '@/hooks/useDeposit';
import { useWithdraw } from '@/hooks/useWithdraw';
import { formatEurcDisplay, formatPercentage, parseEurc } from '@/lib/utils';
import { EURC_DECIMALS, EURC_MINT } from '@/lib/constants';
import { VaultData } from '@/hooks/useVault';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowsDownUp, Spinner } from '@phosphor-icons/react';

interface DepositWithdrawModalProps {
  vault: VaultData;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw';
}

export function DepositWithdrawModal({
  vault,
  isOpen,
  onClose,
  initialTab = 'deposit',
}: DepositWithdrawModalProps) {
  const { connected } = useWallet();
  const { stake, refetch: refetchStake } = useUserStake(vault.slug);
  const { balance: eurcBalance } = useTokenBalance(EURC_MINT);
  const { deposit, loading: depositLoading } = useDeposit(vault.slug);
  const { initiateWithdrawal, loading: withdrawLoading } = useWithdraw(vault.slug);

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [amount, setAmount] = useState('');

  const numericAmount = parseFloat(amount) || 0;
  const amountBaseUnits = Math.floor(numericAmount * Math.pow(10, EURC_DECIMALS));
  const isLoading = depositLoading || withdrawLoading;

  const canDeposit =
    numericAmount > 0 &&
    amountBaseUnits >= vault.minDeposit &&
    amountBaseUnits <= eurcBalance &&
    !vault.paused;

  const canWithdraw =
    numericAmount > 0 &&
    amountBaseUnits <= (stake?.pbEurcBalance ?? 0) &&
    !(stake?.isInCooldown);

  const handleMax = useCallback(() => {
    const base = activeTab === 'deposit' ? eurcBalance : (stake?.pbEurcBalance ?? 0);
    const maxAmount = base / Math.pow(10, EURC_DECIMALS);
    if (maxAmount > 0) setAmount(maxAmount.toFixed(2));
  }, [activeTab, eurcBalance, stake?.pbEurcBalance]);

  const handleSubmit = async () => {
    if (activeTab === 'deposit' && canDeposit) {
      const sig = await deposit(amountBaseUnits);
      if (sig) {
        setAmount('');
        refetchStake();
        onClose();
      }
    } else if (activeTab === 'withdraw' && canWithdraw) {
      const sig = await initiateWithdrawal(amountBaseUnits);
      if (sig) {
        setAmount('');
        refetchStake();
        onClose();
      }
    }
  };

  if (!connected) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{vault.name}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
                {(['deposit', 'withdraw'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setAmount(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </button>
                ))}
              </div>

              {/* Balance */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-secondary">
                  {activeTab === 'deposit' ? 'Available' : 'Shares'}
                </span>
                <span className="text-foreground font-medium">
                  {formatEurcDisplay(activeTab === 'deposit' ? eurcBalance : (stake?.pbEurcBalance ?? 0))} EURC
                </span>
              </div>

              {/* Amount input */}
              <div className="rounded-xl bg-muted/30 border border-border p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-2xl font-medium text-foreground placeholder:text-foreground-secondary/40 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={handleMax}
                    className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const base = activeTab === 'deposit' ? eurcBalance : (stake?.pbEurcBalance ?? 0);
                      const val = Math.floor(base * pct) / Math.pow(10, EURC_DECIMALS);
                      if (val > 0) setAmount(val.toFixed(2));
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-muted/50 border border-border text-foreground-secondary hover:text-foreground transition-colors"
                  >
                    {pct === 1 ? 'MAX' : `${pct * 100}%`}
                  </button>
                ))}
              </div>

              {/* Info */}
              <div className="flex items-center justify-between text-xs text-foreground-secondary">
                <span>APY</span>
                <span className="text-emerald-500 font-medium">{formatPercentage(vault.apy)}</span>
              </div>

              {/* Action */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || (activeTab === 'deposit' ? !canDeposit : !canWithdraw)}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : activeTab === 'deposit' ? (
                  'Deposit EURC'
                ) : (
                  `Start ${vault.lockPeriodLabel} Cooldown`
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
