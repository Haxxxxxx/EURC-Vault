'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { httpsCallable } from 'firebase/functions';
import { TEST_EURC_MINT, EURC_DECIMALS } from '@/lib/constants';
import { getFirebaseFunctions } from '@/lib/firebase';
import { Drop, CurrencyEur, CaretDown, Check, Warning, Spinner, ArrowSquareOut, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';

type Status = 'idle' | 'loading' | 'success' | 'error';
type AirdropStep = 'requesting' | 'confirming' | 'done';

const SOL_OPTIONS = [1, 2, 5] as const;
const EURC_OPTIONS = [1_000, 10_000, 50_000] as const;

function formatEurcOption(amount: number): string {
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString();
}

export function DevnetFaucet() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [open, setOpen] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [eurcBalance, setEurcBalance] = useState<number | null>(null);
  const [solStatus, setSolStatus] = useState<Status>('idle');
  const [eurcStatus, setEurcStatus] = useState<Status>('idle');
  const [solStep, setSolStep] = useState<AirdropStep | null>(null);
  const [eurcStep, setEurcStep] = useState<AirdropStep | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedSol, setSelectedSol] = useState<number>(2);
  const [selectedEurc, setSelectedEurc] = useState<number>(10_000);
  const [showFaucetLink, setShowFaucetLink] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const faucetLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup faucet link timer on unmount
  useEffect(() => {
    return () => {
      if (faucetLinkTimerRef.current) clearTimeout(faucetLinkTimerRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Refresh balances
  const refresh = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [sol, eurc] = await Promise.all([
        connection.getBalance(publicKey),
        connection
          .getTokenAccountBalance(getAssociatedTokenAddressSync(TEST_EURC_MINT, publicKey))
          .catch(() => null),
      ]);
      setSolBalance(sol / LAMPORTS_PER_SOL);
      setEurcBalance(eurc ? Number(eurc.value.uiAmountString) : 0);
    } catch {
      // silently fail
    }
  }, [connection, publicKey]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (open && connected) refresh();
  }, [open, connected, refresh]);

  const triggerFaucetLink = useCallback(() => {
    setShowFaucetLink(true);
    if (faucetLinkTimerRef.current) clearTimeout(faucetLinkTimerRef.current);
    faucetLinkTimerRef.current = setTimeout(() => setShowFaucetLink(false), 30_000);
  }, []);

  const handleAirdrop = async () => {
    if (!publicKey) return;
    setSolStatus('loading');
    setSolStep('requesting');
    setErrorMsg('');
    try {
      const sig = await connection.requestAirdrop(publicKey, selectedSol * LAMPORTS_PER_SOL);
      setSolStep('confirming');
      await connection.confirmTransaction(sig, 'confirmed');
      setSolStep('done');
      setSolStatus('success');
      await refresh();
      triggerFaucetLink();
      setTimeout(() => {
        setSolStatus('idle');
        setSolStep(null);
      }, 3000);
    } catch (err: any) {
      setSolStatus('error');
      setSolStep(null);
      const isRateLimited = err?.message?.includes('429');
      setErrorMsg(isRateLimited ? 'Rate limited — try the web faucet' : 'Airdrop failed');
      if (isRateLimited) triggerFaucetLink();
      setTimeout(() => setSolStatus('idle'), 4000);
    }
  };

  const handleMint = async () => {
    if (!publicKey) return;
    setEurcStatus('loading');
    setEurcStep('requesting');
    setErrorMsg('');
    try {
      const functions = getFirebaseFunctions();
      if (!functions) {
        throw new Error('Firebase not configured — cannot use backend faucet');
      }
      const mintTestEurc = httpsCallable<
        { wallet: string; amount: number },
        { success: boolean; signature: string }
      >(functions, 'mintTestEurc');

      setEurcStep('confirming');
      const result = await mintTestEurc({
        wallet: publicKey.toBase58(),
        amount: selectedEurc,
      });

      if (result.data.success) {
        setEurcStep('done');
        setEurcStatus('success');
        await refresh();
        setTimeout(() => {
          setEurcStatus('idle');
          setEurcStep(null);
        }, 3000);
      } else {
        throw new Error('Mint request returned unsuccessful');
      }
    } catch (err: any) {
      setEurcStatus('error');
      setEurcStep(null);
      const msg = err?.message || '';
      if (msg.includes('resource-exhausted') || msg.includes('Rate limit')) {
        setErrorMsg('Rate limit exceeded — try again in 24h');
      } else if (msg.includes('Firebase not configured')) {
        setErrorMsg('Backend faucet not deployed — configure Firebase first');
      } else {
        setErrorMsg('Mint failed — check console for details');
      }
      setTimeout(() => setEurcStatus('idle'), 4000);
    }
  };

  if (!connected) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-600 dark:text-violet-400 text-xs font-medium transition-colors"
      >
        <Drop className="w-4 h-4" weight="fill" />
        <span className="hidden sm:inline">Faucet</span>
        <CaretDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} weight="bold" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-medium text-foreground">Devnet Faucet</p>
            <p className="text-[10px] text-foreground-secondary">Fund your wallet for testing</p>
          </div>

          <div className="p-3 space-y-3">
            {/* SOL Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center">
                    <Drop className="w-4 h-4 text-violet-500" weight="fill" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">SOL</p>
                    <p className="text-[10px] text-foreground-secondary font-mono">
                      {solBalance !== null ? `${solBalance.toFixed(3)} SOL` : '\u2014'}
                    </p>
                  </div>
                </div>
                <button
                  disabled={solStatus === 'loading'}
                  onClick={handleAirdrop}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {solStatus === 'loading' ? (
                    <Spinner className="w-3 h-3 animate-spin" />
                  ) : solStatus === 'success' ? (
                    <Check className="w-3 h-3" weight="bold" />
                  ) : solStatus === 'error' ? (
                    <Warning className="w-3 h-3" weight="bold" />
                  ) : null}
                  {solStatus === 'success' ? `+${selectedSol} SOL` : solStatus === 'error' ? 'Retry' : `+${selectedSol} SOL`}
                </button>
              </div>

              {/* SOL amount chips */}
              <div className="flex items-center gap-1.5 pl-10">
                {SOL_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedSol(amt)}
                    disabled={solStatus === 'loading'}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      selectedSol === amt
                        ? 'bg-violet-600 text-white'
                        : 'bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600/20'
                    } disabled:opacity-50`}
                  >
                    {amt} SOL
                  </button>
                ))}
              </div>

              {/* SOL step progress */}
              {solStep && <StepIndicator step={solStep} />}
            </div>

            {/* EURC Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <CurrencyEur className="w-4 h-4 text-emerald-500" weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Test EURC</p>
                    <p className="text-[10px] text-foreground-secondary font-mono">
                      {eurcBalance !== null ? `${eurcBalance.toLocaleString()} EURC` : '\u2014'}
                    </p>
                  </div>
                </div>
                <button
                  disabled={eurcStatus === 'loading'}
                  onClick={handleMint}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {eurcStatus === 'loading' ? (
                    <Spinner className="w-3 h-3 animate-spin" />
                  ) : eurcStatus === 'success' ? (
                    <Check className="w-3 h-3" weight="bold" />
                  ) : eurcStatus === 'error' ? (
                    <Warning className="w-3 h-3" weight="bold" />
                  ) : null}
                  {eurcStatus === 'success'
                    ? `+${formatEurcOption(selectedEurc)}`
                    : eurcStatus === 'error'
                      ? 'Retry'
                      : `+${formatEurcOption(selectedEurc)} EURC`}
                </button>
              </div>

              {/* EURC amount chips */}
              <div className="flex items-center gap-1.5 pl-10">
                {EURC_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedEurc(amt)}
                    disabled={eurcStatus === 'loading'}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      selectedEurc === amt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20'
                    } disabled:opacity-50`}
                  >
                    {formatEurcOption(amt)} EURC
                  </button>
                ))}
              </div>

              {/* EURC step progress */}
              {eurcStep && <StepIndicator step={eurcStep} variant="emerald" />}
            </div>

            {/* Error message */}
            {errorMsg && (
              <p className="text-[10px] text-red-500 text-center">{errorMsg}</p>
            )}

            {/* Rate-limit / web faucet link */}
            {showFaucetLink && (
              <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Warning className="w-3 h-3 text-amber-500 flex-shrink-0" weight="bold" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Rate limited? Try the{' '}
                  <a
                    href="https://faucet.solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-0.5"
                  >
                    web faucet
                    <ArrowSquareOut className="w-2.5 h-2.5" weight="bold" />
                  </a>
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-border bg-muted/20 space-y-1.5">
            <p className="text-[10px] text-foreground-secondary text-center">
              EURC minting uses a backend faucet — no mint authority needed
            </p>
            <Link
              href="/devnet"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 text-[10px] font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Open full testing dashboard
              <ArrowRight className="w-3 h-3" weight="bold" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step indicator sub-component                                        */
/* ------------------------------------------------------------------ */

const STEPS: AirdropStep[] = ['requesting', 'confirming', 'done'];
const STEP_LABELS: Record<AirdropStep, string> = {
  requesting: 'Requesting',
  confirming: 'Confirming',
  done: 'Done',
};

function StepIndicator({
  step,
  variant = 'violet',
}: {
  step: AirdropStep;
  variant?: 'violet' | 'emerald';
}) {
  const currentIdx = STEPS.indexOf(step);
  const barColor = variant === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500';
  const textActive = variant === 'emerald' ? 'text-emerald-500' : 'text-violet-500';
  const dotActive = variant === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500';
  const progressPercent = step === 'requesting' ? 0 : step === 'confirming' ? 50 : 100;

  return (
    <div className="pl-10 space-y-1">
      {/* Progress bar */}
      <div className="relative h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {/* Step labels */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i <= currentIdx ? dotActive : 'bg-muted-foreground/30'
              }`}
            />
            <span
              className={`text-[9px] font-medium transition-colors ${
                i <= currentIdx ? textActive : 'text-foreground-secondary/50'
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
