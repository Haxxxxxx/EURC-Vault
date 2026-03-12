'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVault } from '@/hooks/useVault';
import { useUserStake } from '@/hooks/useUserStake';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useDeposit } from '@/hooks/useDeposit';
import { useWithdraw } from '@/hooks/useWithdraw';
import { useEmergencyWithdraw } from '@/hooks/useEmergencyWithdraw';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { PageTransition } from '@/components/motion/PageTransition';
import { FadeIn } from '@/components/motion/FadeIn';
import { formatEurcDisplay, formatPercentage, formatTimestamp, calculateProjectedEarnings } from '@/lib/utils';
import { EURC_DECIMALS, EURC_MINT } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowsDownUp,
  TrendUp,
  GasPump,
  Info,
  Wallet,
  Clock,
  WarningCircle,
  CheckCircle,
  ArrowSquareOut,
  X,
} from '@phosphor-icons/react';

const VAULT_TOKEN_SYMBOLS: Record<string, string> = {
  'main-eurc-stability': 'vMain',
  'high-yield': 'vHigh',
  'premium-locked': 'vPrem',
  'conservative': 'vCons',
};

const TX_STEPS = [
  { key: 'building', label: 'Building transaction' },
  { key: 'signing', label: 'Awaiting signature' },
  { key: 'confirming', label: 'Confirming on-chain' },
] as const;

interface DepositWithdrawPageProps {
  params: Promise<{ vaultId: string }>;
}

export default function DepositWithdrawPage({ params }: DepositWithdrawPageProps) {
  const { vaultId } = use(params);
  const { connected } = useWallet();
  const { vault, loading: vaultLoading } = useVault(vaultId);
  const { stake, refetch: refetchStake } = useUserStake(vaultId);
  const { balance: eurcBalance } = useTokenBalance(EURC_MINT);
  const { deposit, loading: depositLoading } = useDeposit(vaultId);
  const { initiateWithdrawal, completeWithdrawal, cancelWithdrawal, loading: withdrawLoading } = useWithdraw(vaultId);
  const { emergencyWithdraw, loading: emergencyLoading } = useEmergencyWithdraw(vaultId);

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [showEmergency, setShowEmergency] = useState(false);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'deposit' | 'withdraw' | null>(null);

  // Success overlay state
  const [txSuccess, setTxSuccess] = useState<{ signature: string; type: 'deposit' | 'withdraw' } | null>(null);

  // Multi-step loading indicator
  const [txStep, setTxStep] = useState<'building' | 'signing' | 'confirming' | null>(null);
  const txTimersRef = useRef<{ signing?: ReturnType<typeof setTimeout>; confirming?: ReturnType<typeof setTimeout> }>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (txTimersRef.current.signing) clearTimeout(txTimersRef.current.signing);
      if (txTimersRef.current.confirming) clearTimeout(txTimersRef.current.confirming);
    };
  }, []);

  const numericAmount = parseFloat(amount) || 0;
  const amountBaseUnits = Math.floor(numericAmount * Math.pow(10, EURC_DECIMALS));

  const isLoading = depositLoading || withdrawLoading || emergencyLoading;

  // Auto-dismiss success overlay after 8 seconds
  useEffect(() => {
    if (!txSuccess) return;
    const timer = setTimeout(() => setTxSuccess(null), 8000);
    return () => clearTimeout(timer);
  }, [txSuccess]);

  // --- Quick Amount Presets ---
  const handlePreset = useCallback((pct: number) => {
    const base = activeTab === 'deposit' ? eurcBalance : (stake?.pbEurcBalance ?? 0);
    const presetAmount = Math.floor(base * pct) / Math.pow(10, EURC_DECIMALS);
    if (presetAmount > 0) {
      setAmount(presetAmount.toFixed(2));
    }
  }, [activeTab, eurcBalance, stake?.pbEurcBalance]);

  if (vaultLoading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <div className="w-full max-w-lg space-y-6">
          <Skeleton height="500px" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton height="100px" />
            <Skeleton height="100px" />
          </div>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <h2 className="text-2xl font-medium text-foreground mb-2">Vault Not Found</h2>
          <p className="text-foreground-secondary font-light mb-4">
            The requested vault could not be found.
          </p>
          <Link
            href="/vaults"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" weight="bold" />
            Back to Vaults
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <GlassCard padding="lg" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-medium text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-foreground-secondary font-light">
            Connect your wallet to deposit or withdraw from {vault.name}
          </p>
        </GlassCard>
      </div>
    );
  }

  const availableBalance = eurcBalance;
  const stakedBalance = stake?.pbEurcBalance ?? 0;
  const isInCooldown = stake?.isInCooldown ?? false;
  const cooldownComplete = stake?.cooldownComplete ?? false;
  const pendingWithdrawal = stake?.pendingWithdrawalEurc ?? 0;
  const withdrawalAvailableAt = stake?.withdrawalAvailableAt ?? 0;

  const projected = calculateProjectedEarnings(numericAmount, vault.apy);

  // --- Deposit / Withdraw Validation ---
  const depositValidationError = (() => {
    if (activeTab !== 'deposit' || amount === '') return null;
    if (numericAmount <= 0) return 'Amount must be greater than 0';
    if (amountBaseUnits < vault.minDeposit) {
      return `Minimum deposit is ${vault.minDepositLabel}`;
    }
    if (vault.tvl + amountBaseUnits > vault.capacity) {
      return 'Vault capacity would be exceeded';
    }
    if (amountBaseUnits > availableBalance) {
      return 'Insufficient EURC balance';
    }
    if (vault.paused) return 'Vault is currently paused';
    return null;
  })();

  const withdrawValidationError = (() => {
    if (activeTab !== 'withdraw' || amount === '') return null;
    if (numericAmount <= 0) return 'Amount must be greater than 0';
    if (amountBaseUnits > stakedBalance) return 'Exceeds your share balance';
    if (isInCooldown) return 'Withdrawal already in cooldown';
    return null;
  })();

  const activeValidationError = activeTab === 'deposit' ? depositValidationError : withdrawValidationError;

  const canDeposit =
    numericAmount > 0 &&
    !depositValidationError &&
    !vault.paused;

  const canInitiateWithdraw =
    numericAmount > 0 &&
    !withdrawValidationError &&
    !isInCooldown;

  const handleMax = () => {
    if (activeTab === 'deposit') {
      setAmount(formatEurcDisplay(availableBalance, EURC_DECIMALS).replace(/,/g, ''));
    } else {
      setAmount(formatEurcDisplay(stakedBalance, EURC_DECIMALS).replace(/,/g, ''));
    }
  };

  // Open confirmation modal instead of directly executing
  const handleActionClick = (action: 'deposit' | 'withdraw') => {
    setPendingAction(action);
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);

    if (pendingAction === 'deposit') {
      await handleDeposit();
    } else if (pendingAction === 'withdraw') {
      await handleInitiateWithdraw();
    }

    setPendingAction(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const clearTxTimers = () => {
    if (txTimersRef.current.signing) clearTimeout(txTimersRef.current.signing);
    if (txTimersRef.current.confirming) clearTimeout(txTimersRef.current.confirming);
    txTimersRef.current = {};
  };

  const handleDeposit = async () => {
    if (!canDeposit) return;

    setTxStep('building');
    txTimersRef.current.signing = setTimeout(() => setTxStep('signing'), 800);
    txTimersRef.current.confirming = setTimeout(() => setTxStep('confirming'), 2500);

    try {
      const sig = await deposit(amountBaseUnits);

      clearTxTimers();
      setTxStep(null);

      if (sig) {
        setTxSuccess({ signature: sig, type: 'deposit' });
        setAmount('');
        refetchStake();
      }
    } catch {
      clearTxTimers();
      setTxStep(null);
    }
  };

  const handleInitiateWithdraw = async () => {
    if (!canInitiateWithdraw) return;

    setTxStep('building');
    txTimersRef.current.signing = setTimeout(() => setTxStep('signing'), 800);
    txTimersRef.current.confirming = setTimeout(() => setTxStep('confirming'), 2500);

    try {
      const sig = await initiateWithdrawal(amountBaseUnits);

      clearTxTimers();
      setTxStep(null);

      if (sig) {
        setTxSuccess({ signature: sig, type: 'withdraw' });
        setAmount('');
        refetchStake();
      }
    } catch {
      clearTxTimers();
      setTxStep(null);
    }
  };

  const handleCompleteWithdraw = async () => {
    const sig = await completeWithdrawal();
    if (sig) refetchStake();
  };

  const handleCancelWithdraw = async () => {
    const sig = await cancelWithdrawal();
    if (sig) refetchStake();
  };

  return (
    <PageTransition>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center relative">
        <div className="w-full max-w-lg space-y-6">
          {/* Back Link */}
          <Link
            href={`/vaults/${vault.slug}`}
            className="inline-flex items-center gap-2 text-sm font-light text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" weight="bold" />
            Back to {vault.name}
          </Link>

          {/* Main Card */}
          <FadeIn>
            <GlassCard padding="lg">
              {/* Vault Status Warnings */}
              {vault.paused && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-error/10 border border-error/20">
                  <Badge variant="error">Vault Paused — Deposits Disabled</Badge>
                  <p className="text-xs text-foreground-secondary">Withdrawals and emergency exit remain available.</p>
                </div>
              )}
              {!vault.paused && vault.tvl >= vault.capacity && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <Badge variant="warning">At Capacity — Deposits Blocked</Badge>
                </div>
              )}
              {isInCooldown && !cooldownComplete && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Badge variant="info">Cooldown Active</Badge>
                  <p className="text-xs text-foreground-secondary">
                    Available after {formatTimestamp(withdrawalAvailableAt * 1000)}
                  </p>
                </div>
              )}

              {/* Header + Tab Toggle */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-medium text-foreground">{vault.name}</h2>
                <div className="relative flex items-center gap-1 rounded-xl bg-glass p-1 border border-glass-border">
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-y-1 rounded-lg bg-accent shadow-sm"
                    style={{
                      width: 'calc(50% - 4px)',
                      left: activeTab === 'deposit' ? 4 : 'calc(50%)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                  <button
                    onClick={() => { setActiveTab('deposit'); setAmount(''); }}
                    className={`relative z-10 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'deposit'
                        ? 'text-white'
                        : 'text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => { setActiveTab('withdraw'); setAmount(''); }}
                    className={`relative z-10 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'withdraw'
                        ? 'text-white'
                        : 'text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              {/* Balance Display */}
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-foreground-secondary font-light flex items-center gap-1.5">
                  {activeTab === 'deposit' ? 'Available Balance' : 'Share Balance'}
                  <InfoTooltip
                    text={
                      activeTab === 'deposit'
                        ? 'Your EURC wallet balance available for deposit.'
                        : 'Your pbEURC share balance. Burning shares returns EURC at current exchange rate.'
                    }
                  />
                </span>
                <span className="text-foreground font-medium">
                  <AnimatedNumber value={(activeTab === 'deposit' ? availableBalance : stakedBalance) / 1e6} decimals={2} suffix=" EURC" />
                </span>
              </div>

              {/* Input Field */}
              <div className="rounded-2xl bg-glass border border-glass-border p-4 mb-2">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Limit to 2 decimal places for EURC
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        setAmount(val);
                      }
                    }}
                    disabled={isLoading || (activeTab === 'withdraw' && isInCooldown && !cooldownComplete)}
                    className="flex-1 bg-transparent text-3xl font-light text-foreground placeholder:text-foreground-secondary/40 outline-none h-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleMax}
                      disabled={isLoading}
                      className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                    >
                      MAX
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass border border-glass-border">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">EUR</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">EURC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Helper Text */}
              {activeTab === 'deposit' && (
                <p className="text-xs text-foreground-secondary mb-2">
                  Minimum deposit: {vault.minDepositLabel}.
                </p>
              )}
              {activeTab === 'withdraw' && !isInCooldown && (
                <p className="text-xs text-foreground-secondary mb-2">
                  Only one pending withdrawal allowed at a time.
                </p>
              )}

              {/* Quick Amount Presets */}
              <div className="flex items-center gap-2 mb-4">
                {[
                  { label: '25%', pct: 0.25 },
                  { label: '50%', pct: 0.50 },
                  { label: '75%', pct: 0.75 },
                  { label: 'MAX', pct: 1.0 },
                ].map(({ label, pct }) => (
                  <button
                    key={label}
                    onClick={() => pct === 1.0 ? handleMax() : handlePreset(pct)}
                    disabled={isLoading}
                    className="flex-1 px-2 py-1.5 rounded-full text-xs font-medium bg-glass border border-glass-border text-foreground-secondary hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Validation Error */}
              {activeValidationError && (
                <p className="text-sm text-destructive mb-2">{activeValidationError}</p>
              )}

              {/* Swap Divider */}
              <div className="flex items-center justify-center -my-1 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-glass border border-glass-border flex items-center justify-center shadow-sm">
                  <ArrowsDownUp className="w-5 h-5 text-foreground-secondary" weight="bold" />
                </div>
              </div>

              {/* To (Vault Token) */}
              <div className="rounded-2xl bg-glass border border-glass-border p-4 mb-4">
                <p className="text-xs text-foreground-secondary mb-2">
                  {activeTab === 'deposit' ? 'You Receive' : 'You Get Back'}
                </p>
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-3xl font-light text-foreground/60">
                    {numericAmount > 0 ? numericAmount.toFixed(2) : '0.00'}
                  </span>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass border border-glass-border">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-white">V</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {activeTab === 'deposit'
                        ? (VAULT_TOKEN_SYMBOLS[vault.slug] ?? 'vToken')
                        : 'EURC'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab content with AnimatePresence */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Deposit: Projected Earnings */}
                  {activeTab === 'deposit' && numericAmount > 0 && (
                    <div className="rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 p-4 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendUp className="w-4 h-4 text-accent" weight="bold" />
                        <p className="text-sm font-medium text-foreground">Projected Earnings</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-foreground-secondary mb-1">Monthly ({formatPercentage(vault.apy, 1)} APY)</p>
                          <p className="text-lg font-light text-success">
                            +<AnimatedNumber value={projected.monthly} decimals={2} suffix=" EURC" />
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-foreground-secondary mb-1">Yearly ({formatPercentage(vault.apy, 1)} APY)</p>
                          <p className="text-lg font-light text-success">
                            +<AnimatedNumber value={projected.yearly} decimals={2} suffix=" EURC" />
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Withdraw: Cooldown Info */}
                  {activeTab === 'withdraw' && isInCooldown && (
                    <div className={`rounded-xl p-4 mb-4 ${cooldownComplete ? 'bg-success/5 border border-success/20' : 'bg-warning/5 border border-warning/20'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className={`w-4 h-4 ${cooldownComplete ? 'text-success' : 'text-warning'}`} weight="bold" />
                        <p className="text-sm font-medium text-foreground">Withdrawal Cooldown</p>
                        <Badge variant={cooldownComplete ? 'success' : 'warning'}>
                          {cooldownComplete ? 'Ready' : 'In Progress'}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground-secondary mb-2">
                        Amount: {formatEurcDisplay(pendingWithdrawal, EURC_DECIMALS)} EURC
                      </p>
                      <p className="text-xs text-foreground-secondary mb-3">
                        {cooldownComplete
                          ? 'Your withdrawal is ready to be processed.'
                          : `Available after ${formatTimestamp(withdrawalAvailableAt * 1000)}`}
                      </p>
                      <div className="flex gap-2">
                        {cooldownComplete && (
                          <button
                            onClick={handleCompleteWithdraw}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-success hover:bg-success/90 transition-colors disabled:opacity-50"
                          >
                            {withdrawLoading ? 'Processing...' : 'Complete Withdrawal'}
                          </button>
                        )}
                        <button
                          onClick={handleCancelWithdraw}
                          disabled={isLoading}
                          title="Restores funds to active deposit but forfeits rewards earned during cooldown."
                          className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-secondary bg-glass border border-glass-border hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Withdraw: No cooldown info */}
                  {activeTab === 'withdraw' && !isInCooldown && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="w-4 h-4 text-primary" weight="bold" />
                        <p className="text-sm font-medium text-foreground">Withdrawal Period</p>
                      </div>
                      <p className="text-xs font-light text-foreground-secondary">
                        Withdrawals require a {vault.lockPeriodLabel} cooldown period.
                        Your pbEURC shares will be burned and EURC locked until cooldown ends.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Multi-step Loading Indicator */}
              {txStep && (
                <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 mb-4">
                  <div className="flex flex-col gap-3">
                    {TX_STEPS.map((step, idx) => {
                      const currentIdx = TX_STEPS.findIndex(s => s.key === txStep);
                      const isActive = step.key === txStep;
                      const isComplete = idx < currentIdx;
                      const isPending = idx > currentIdx;

                      return (
                        <div key={step.key} className="flex items-center gap-3">
                          {/* Step indicator */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full transition-all ${
                                isComplete
                                  ? 'bg-success'
                                  : isActive
                                    ? 'bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb,99,102,241),0.5)]'
                                    : 'bg-glass-border'
                              }`}
                            />
                            {idx < TX_STEPS.length - 1 && (
                              <div
                                className={`w-0.5 h-4 mt-1 transition-all ${
                                  isComplete ? 'bg-success' : 'bg-glass-border'
                                }`}
                              />
                            )}
                          </div>
                          {/* Step label */}
                          <span
                            className={`text-sm transition-colors ${
                              isComplete
                                ? 'text-success font-medium'
                                : isActive
                                  ? 'text-foreground font-medium'
                                  : 'text-foreground-secondary/50'
                            }`}
                          >
                            {step.label}
                            {isActive && (
                              <span className="ml-2 inline-block">
                                <span className="animate-pulse">...</span>
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!txStep && (
                <>
                  {activeTab === 'deposit' ? (
                    <button
                      onClick={() => handleActionClick('deposit')}
                      disabled={!canDeposit || isLoading}
                      className={`w-full py-4 rounded-2xl text-base font-medium transition-all ${
                        canDeposit && !isLoading
                          ? 'bg-gradient-to-r from-accent to-accent/90 text-white hover:shadow-lg active:scale-[0.98]'
                          : 'bg-glass text-foreground-secondary cursor-not-allowed border border-glass-border'
                      }`}
                    >
                      Deposit EURC
                    </button>
                  ) : (
                    !isInCooldown && (
                      <button
                        onClick={() => handleActionClick('withdraw')}
                        disabled={!canInitiateWithdraw || isLoading}
                        className={`w-full py-4 rounded-2xl text-base font-medium transition-all ${
                          canInitiateWithdraw && !isLoading
                            ? 'bg-gradient-to-r from-accent to-accent/90 text-white hover:shadow-lg active:scale-[0.98]'
                            : 'bg-glass text-foreground-secondary cursor-not-allowed border border-glass-border'
                        }`}
                      >
                        Start {vault.lockPeriodLabel} Cooldown
                      </button>
                    )
                  )}
                </>
              )}

              {/* Emergency Withdraw */}
              {activeTab === 'withdraw' && stakedBalance > 0 && (
                <div className="mt-4">
                  {!showEmergency ? (
                    <button
                      onClick={() => setShowEmergency(true)}
                      className="flex items-center gap-2 text-sm font-light text-foreground-secondary hover:text-warning transition-colors"
                    >
                      <WarningCircle className="w-4 h-4" weight="bold" />
                      Emergency Withdraw
                    </button>
                  ) : (
                    <div className="rounded-xl bg-error/5 border border-error/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <WarningCircle className="w-4 h-4 text-error" weight="bold" />
                        <p className="text-sm font-medium text-foreground">Emergency Withdrawal</p>
                      </div>
                      <p className="text-xs font-light text-foreground-secondary mb-3">
                        Exit the vault immediately — bypasses cooldown and works even when the vault is paused.
                        Returns all active deposits + pending withdrawals + accrued rewards. No penalty.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const sig = await emergencyWithdraw();
                            if (sig) {
                              setShowEmergency(false);
                              refetchStake();
                            }
                          }}
                          disabled={isLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-error hover:bg-error/90 transition-colors disabled:opacity-50"
                        >
                          {emergencyLoading ? 'Processing...' : 'Confirm Emergency Withdraw'}
                        </button>
                        <button
                          onClick={() => setShowEmergency(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-secondary bg-glass border border-glass-border hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Swap Details */}
              {numericAmount > 0 && (
                <details className="mt-4 group">
                  <summary className="flex items-center gap-2 text-sm text-foreground-secondary cursor-pointer hover:text-foreground transition-colors">
                    <Info className="w-4 h-4" weight="bold" />
                    <span>Swap details</span>
                  </summary>
                  <div className="mt-3 rounded-xl bg-glass border border-glass-border p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">Exchange rate</span>
                      <span className="text-foreground font-medium">
                        1 EURC = {vault.exchangeRate ? (1 / vault.exchangeRate).toFixed(4) : '1.0000'} pbEURC
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">Network fee</span>
                      <span className="text-foreground font-medium">~0.00025 SOL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">Protocol fee</span>
                      <span className="text-foreground font-medium">0%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">Slippage</span>
                      <span className="text-foreground font-medium">None (fixed rate)</span>
                    </div>
                  </div>
                </details>
              )}

              {/* Gas Estimate */}
              <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-foreground-secondary">
                <GasPump className="w-3.5 h-3.5" />
                <span>Estimated gas: ~0.00025 SOL</span>
              </div>
            </GlassCard>
          </FadeIn>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            <FadeIn delay={0.1}>
              <GlassCard padding="md">
                <p className="text-xs text-foreground-secondary mb-1">Current APY</p>
                <p className="text-2xl font-light text-success">
                  <AnimatedNumber value={vault.apy} decimals={1} suffix="%" />
                </p>
                <p className="text-xs text-foreground-secondary mt-1">{vault.name}</p>
              </GlassCard>
            </FadeIn>
            <FadeIn delay={0.2}>
              <GlassCard padding="md">
                <p className="text-xs text-foreground-secondary mb-1">Vault TVL</p>
                <p className="text-2xl font-light text-foreground">
                  <AnimatedNumber value={vault.tvl / 1e6} decimals={2} />
                </p>
                <p className="text-xs text-foreground-secondary mt-1">EURC</p>
              </GlassCard>
            </FadeIn>
          </div>
        </div>

        {/* ========== Confirmation Modal ========== */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleCancelConfirm}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              {/* Modal Body */}
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Confirm ${pendingAction === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative z-10 w-full max-w-md"
                onKeyDown={(e) => {
                  if (e.key !== 'Tab') return;
                  const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
                    'button, [href], input, [tabindex]:not([tabindex="-1"])'
                  );
                  if (focusable.length === 0) return;
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                  }
                }}
              >
                <GlassCard padding="lg">
                  {/* Close button */}
                  <button
                    autoFocus
                    onClick={handleCancelConfirm}
                    aria-label="Close confirmation"
                    className="absolute top-4 right-4 p-1 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" weight="bold" />
                  </button>

                  <h3 className="text-xl font-medium text-foreground mb-4">
                    Confirm {pendingAction === 'deposit' ? 'Deposit' : 'Withdrawal'}
                  </h3>

                  {/* Summary */}
                  <div className="rounded-xl bg-glass border border-glass-border p-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground-secondary">Action</span>
                      <Badge variant={pendingAction === 'deposit' ? 'default' : 'warning'}>
                        {pendingAction === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground-secondary">Amount</span>
                      <span className="text-sm font-medium text-foreground">{numericAmount.toFixed(2)} EURC</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground-secondary">Vault</span>
                      <span className="text-sm font-medium text-foreground">{vault.name}</span>
                    </div>
                    <div className="border-t border-glass-border my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground-secondary flex items-center gap-1.5">
                        <GasPump className="w-3.5 h-3.5" />
                        Est. gas
                      </span>
                      <span className="text-sm font-medium text-foreground">~0.00025 SOL</span>
                    </div>
                  </div>

                  <p className={`text-xs text-foreground-secondary leading-relaxed ${pendingAction === 'withdraw' ? 'mb-3' : 'mb-5'}`}>
                    {pendingAction === 'deposit'
                      ? `You're depositing ${numericAmount.toFixed(2)} EURC into ${vault.name}. This action will transfer tokens from your wallet to the vault.`
                      : `You're initiating a withdrawal of ${numericAmount.toFixed(2)} EURC from ${vault.name}. A cooldown period of ${vault.lockPeriodLabel} will begin.`}
                  </p>
                  {pendingAction === 'withdraw' && (
                    <p className="text-xs text-warning mb-5 leading-relaxed">
                      This amount will immediately stop earning rewards. You can cancel the withdrawal anytime before the cooldown expires, but you&apos;ll forfeit cooldown-period rewards.
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      size="md"
                      fullWidth
                      onClick={handleCancelConfirm}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      onClick={handleConfirm}
                      className="bg-gradient-to-r from-accent to-accent/90 hover:shadow-lg"
                    >
                      Confirm
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== Success Overlay ========== */}
        <AnimatePresence>
          {txSuccess && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setTxSuccess(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              {/* Success Card */}
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Transaction successful"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="relative z-10 w-full max-w-md"
              >
                <GlassCard padding="lg" className="text-center">
                  {/* Close */}
                  <button
                    onClick={() => setTxSuccess(null)}
                    aria-label="Dismiss"
                    className="absolute top-4 right-4 p-1 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" weight="bold" />
                  </button>

                  {/* Checkmark */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="mx-auto mb-4"
                  >
                    <CheckCircle className="w-16 h-16 text-success mx-auto" weight="fill" />
                  </motion.div>

                  <h3 className="text-xl font-medium text-foreground mb-2">
                    {txSuccess.type === 'deposit' ? 'Deposit Successful!' : 'Withdrawal Initiated!'}
                  </h3>
                  <p className="text-sm text-foreground-secondary font-light mb-5">
                    {txSuccess.type === 'deposit'
                      ? 'Your EURC has been deposited into the vault.'
                      : 'Your withdrawal cooldown has started.'}
                  </p>

                  {/* New balance preview */}
                  <div className="rounded-xl bg-glass border border-glass-border p-4 mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground-secondary">Wallet Balance</span>
                      <span className="text-foreground font-medium">
                        <AnimatedNumber value={availableBalance / 1e6} decimals={2} suffix=" EURC" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground-secondary">Position Value</span>
                      <span className="text-foreground font-medium">
                        <AnimatedNumber value={stakedBalance / 1e6} decimals={2} suffix=" EURC" />
                      </span>
                    </div>
                  </div>

                  {/* Explorer Link */}
                  <a
                    href={`https://explorer.solana.com/tx/${txSuccess.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors mb-5"
                  >
                    <span>View on Solana Explorer</span>
                    <ArrowSquareOut className="w-4 h-4" weight="bold" />
                  </a>

                  {/* Done Button */}
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => setTxSuccess(null)}
                    className="bg-gradient-to-r from-accent to-accent/90"
                  >
                    Done
                  </Button>

                  {/* Auto-dismiss progress bar */}
                  <div className="mt-4 h-0.5 w-full rounded-full bg-glass-border overflow-hidden">
                    <motion.div
                      className="h-full bg-accent/40 rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 8, ease: 'linear' }}
                    />
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
