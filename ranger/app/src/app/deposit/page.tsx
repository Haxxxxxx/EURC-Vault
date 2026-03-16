'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownUp,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import { VoltrClient } from '@voltr/vault-sdk';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useVaultState } from '@/hooks/useVaultState';
import { useToast } from '@/components/ui/Toast';
import { VAULT_ADDRESS, EURC_MINT, EURC_PRECISION, MGMT_FEE_BPS, PERF_FEE_BPS, explorerTxUrl } from '@/lib/constants';
import { parseUserError } from '@/lib/errors';
import { formatTvl } from '@/lib/format';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'deposit' | 'withdraw';

type TxState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; txSig: string; amount: number; tab: Tab }
  | { status: 'error'; message: string };

/** Debounce delay for LP preview RPC calls (ms) */
const LP_PREVIEW_DEBOUNCE_MS = 400;

/** WalletMultiButton style — extracted to avoid re-creation on every render */
const WALLET_BUTTON_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  borderRadius: '0.75rem',
  fontSize: '0.9375rem',
  fontWeight: '600',
  height: '3rem',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: string;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {loading ? (
        <div className="h-5 w-16 rounded bg-secondary animate-pulse" />
      ) : (
        <span className={clsx('text-sm font-semibold tabular-nums', accent ?? 'text-foreground')}>
          {value}
        </span>
      )}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  onMax,
  max,
  label,
  tokenLabel,
  subtext,
}: {
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
  max: number;
  label: string;
  tokenLabel: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          onClick={onMax}
          className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          MAX {max.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenLabel}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          aria-label={label}
          value={value}
          onChange={(e) => {
            // Strip non-numeric chars except '.', cap to 6 decimals (EURC precision)
            let v = e.target.value.replace(/[^0-9.]/g, '');
            const parts = v.split('.');
            if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
            if (parts[1]?.length > 6) v = parts[0] + '.' + parts[1].slice(0, 6);
            onChange(v);
          }}
          className="flex-1 bg-transparent text-2xl font-bold text-foreground placeholder-muted-foreground/40 outline-none tabular-nums"
        />
        <div className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 shrink-0">
          <span className="text-sm font-semibold text-foreground">{tokenLabel}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

function OutputPreview({
  amount,
  tokenLabel,
  subtext,
  tooltip,
}: {
  amount: number | null;
  tokenLabel: string;
  subtext: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">You receive</span>
        {tooltip && (
          <span className="group relative">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
            <span className="invisible group-hover:visible absolute right-0 bottom-full mb-2 w-56 rounded-lg bg-card border border-border p-2.5 text-[11px] text-muted-foreground leading-relaxed shadow-lg z-10">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={clsx('flex-1 text-2xl font-bold tabular-nums', amount !== null ? 'text-foreground' : 'text-muted-foreground')}>
          {amount !== null ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
        </span>
        <div className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 shrink-0">
          <span className="text-sm font-semibold text-foreground">{tokenLabel}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DepositPage() {
  usePageTitle('Deposit');
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { metrics, loading: metricsLoading } = useRangerMetrics();
  const vault = useVaultState();
  const { toast } = useToast();

  const [tab, setTab]       = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });
  const [lpPreviewShares, setLpPreviewShares] = useState<number | null>(null);

  const isVaultLive = Boolean(VAULT_ADDRESS);
  const { eurcBalance, userShares, exchangeRate, tvl } = vault;

  // Debounced LP preview — avoids hammering RPC on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!isVaultLive || tab !== 'deposit') { setLpPreviewShares(null); return; }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setLpPreviewShares(null); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const client = new VoltrClient(connection);
        const atoms  = new BN(Math.floor(parsed * EURC_PRECISION));
        const lp     = await client.calculateLpTokensForDeposit(atoms, new PublicKey(VAULT_ADDRESS));
        setLpPreviewShares(lp.toNumber() / EURC_PRECISION);
      } catch {
        // Fall back to exchange-rate math
        setLpPreviewShares(parsed / exchangeRate);
      }
    }, LP_PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [amount, tab, isVaultLive, connection, exchangeRate]);

  // Reset form when switching tabs
  useEffect(() => {
    setAmount('');
    setTxState({ status: 'idle' });
    setLpPreviewShares(null);
  }, [tab]);

  const currentApy       = metrics?.currentApyPct ?? 0;
  const displayTvl       = metrics?.tvlEurc ?? tvl;
  const userSharesInEurc = userShares * exchangeRate;

  const parsedAmount = parseFloat(amount) || 0;

  // For deposit: EURC in → pbEURC shares out (use on-chain preview when available)
  const depositPreview  = lpPreviewShares ?? (parsedAmount > 0 ? parsedAmount / exchangeRate : null);
  // For withdraw: EURC desired → pbEURC shares to burn
  const withdrawPreview = parsedAmount > 0 ? parsedAmount / exchangeRate : null;

  const maxDeposit  = eurcBalance;
  const maxWithdraw = userSharesInEurc; // withdraw up to full position

  // Validation
  const isAmountValid =
    parsedAmount > 0 &&
    (tab === 'deposit'
      ? parsedAmount <= eurcBalance
      : parsedAmount <= userSharesInEurc);

  const canSubmit = connected && isVaultLive && isAmountValid && txState.status !== 'pending';
  const submittingRef = useRef(false);

  const handleAction = useCallback(async () => {
    if (submittingRef.current || !canSubmit || !publicKey) return;
    submittingRef.current = true;

    setTxState({ status: 'pending' });

    try {
      if (!isVaultLive) {
        setTxState({ status: 'error', message: 'Vault is not deployed yet. Set NEXT_PUBLIC_VAULT_ADDRESS to enable transactions.' });
        return;
      }

      const client      = new VoltrClient(connection);
      const vaultPubkey = new PublicKey(VAULT_ADDRESS);

      // Ensure user's EURC and pbEURC token accounts exist (create if missing)
      const setupIxs: import('@solana/web3.js').TransactionInstruction[] = [];
      const { vaultLpMint } = await client.findVaultAddresses(vaultPubkey);
      const [userEurcAta, userLpAta] = await Promise.all([
        getAssociatedTokenAddress(EURC_MINT, publicKey),
        getAssociatedTokenAddress(vaultLpMint, publicKey),
      ]);
      const [eurcAtaInfo, lpAtaInfo] = await Promise.all([
        connection.getAccountInfo(userEurcAta),
        connection.getAccountInfo(userLpAta),
      ]);
      if (!eurcAtaInfo) {
        setupIxs.push(
          createAssociatedTokenAccountInstruction(publicKey, userEurcAta, publicKey, EURC_MINT),
        );
      }
      if (!lpAtaInfo) {
        setupIxs.push(
          createAssociatedTokenAccountInstruction(publicKey, userLpAta, publicKey, vaultLpMint),
        );
      }

      let ix;
      if (tab === 'deposit') {
        const atomsIn = new BN(Math.floor(parsedAmount * EURC_PRECISION));
        ix = await client.createDepositVaultIx(atomsIn, {
          userAuthority:     publicKey,
          vault:             vaultPubkey,
          vaultAssetMint:    EURC_MINT,
          assetTokenProgram: TOKEN_PROGRAM_ID,
        });
      } else {
        // Withdraw: amount is EURC, convert to LP shares
        if (!withdrawPreview || withdrawPreview <= 0) {
          setTxState({ status: 'error', message: 'Could not compute share amount. Please try again.' });
          return;
        }
        const lpAtoms = new BN(Math.floor(withdrawPreview * EURC_PRECISION));
        ix = await client.createWithdrawVaultIx(
          { amount: lpAtoms, isAmountInLp: true, isWithdrawAll: false },
          {
            userAuthority:     publicKey,
            vault:             vaultPubkey,
            vaultAssetMint:    EURC_MINT,
            assetTokenProgram: TOKEN_PROGRAM_ID,
          },
        );
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      tx.add(...setupIxs, ix);
      const txSig = await sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction(
        { signature: txSig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      setTxState({ status: 'success', txSig, amount: parsedAmount, tab });
      setAmount('');
      setLpPreviewShares(null);
      vault.refetch();
      toast(
        tab === 'deposit'
          ? `Deposited ${parsedAmount.toLocaleString()} EURC successfully`
          : `Withdrew ${parsedAmount.toLocaleString()} EURC successfully`,
        { type: 'success', title: tab === 'deposit' ? 'Deposit Confirmed' : 'Withdrawal Confirmed' },
      );
    } catch (err) {
      const message = parseUserError(err);
      setTxState({ status: 'error', message });
      toast(message, { type: 'error', title: 'Transaction Failed' });
    } finally {
      submittingRef.current = false;
    }
  }, [canSubmit, publicKey, parsedAmount, tab, isVaultLive, connection, sendTransaction, withdrawPreview, toast]);


  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-lg px-4 py-10">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Vault
        </Link>

        {/* Vault not deployed warning */}
        {!isVaultLive && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-300">Vault Not Deployed</p>
              <p className="mt-0.5 text-xs text-yellow-400/80">
                The vault contract is not yet deployed on-chain. Deposits and withdrawals are disabled until deployment.
                You can still explore the{' '}
                <Link href="/dashboard" className="underline hover:text-yellow-300 transition-colors">dashboard</Link>,{' '}
                <Link href="/simulator" className="underline hover:text-yellow-300 transition-colors">simulator</Link>,{' '}
                and <Link href="/docs" className="underline hover:text-yellow-300 transition-colors">documentation</Link>.
              </p>
            </div>
          </div>
        )}

        {/* Vault data error */}
        {vault.error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Failed to load vault data</p>
              <p className="mt-0.5 text-xs text-red-400/80">{vault.error}</p>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/10 ring-1 ring-border/50">

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['deposit', 'withdraw'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-1 py-4 text-sm font-semibold transition-colors capitalize',
                  tab === t
                    ? 'text-foreground border-b-2 border-primary -mb-px'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-3">

            {/* Vault stats row */}
            <div className="flex items-center justify-around rounded-xl border border-border bg-secondary/20 py-3 px-2">
              <StatPill
                label="Current APY"
                value={metricsLoading ? '…' : `${currentApy.toFixed(2)}%`}
                loading={metricsLoading}
                accent="text-emerald-400"
              />
              <div className="h-8 w-px bg-border" />
              <StatPill
                label="TVL"
                value={formatTvl(displayTvl)}
                loading={metricsLoading}
              />
              <div className="h-8 w-px bg-border" />
              <StatPill
                label="Exchange Rate"
                value={exchangeRate > 0 ? `1 : ${exchangeRate.toFixed(4)}` : '—'}
              />
            </div>

            {/* Input */}
            {tab === 'deposit' ? (
              <AmountInput
                label="You deposit"
                tokenLabel="EURC"
                value={amount}
                onChange={setAmount}
                onMax={() => setAmount(maxDeposit.toString())}
                max={maxDeposit}
                subtext={
                  connected
                    ? `Wallet balance: ${eurcBalance.toLocaleString()} EURC`
                    : 'Connect wallet to see balance'
                }
              />
            ) : (
              <AmountInput
                label="You withdraw (EURC equivalent)"
                tokenLabel="EURC"
                value={amount}
                onChange={setAmount}
                onMax={() => setAmount(maxWithdraw.toFixed(2))}
                max={maxWithdraw}
                subtext={
                  connected
                    ? `Position: ${userShares.toLocaleString(undefined, { maximumFractionDigits: 2 })} pbEURC (≈ ${userSharesInEurc.toLocaleString(undefined, { maximumFractionDigits: 2 })} EURC)`
                    : 'Connect wallet to see position'
                }
              />
            )}

            {/* Arrow divider */}
            <div className="flex items-center justify-center group/arrow">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary group-hover/arrow:border-primary/30 group-hover/arrow:bg-primary/5 transition-all duration-200">
                <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground group-hover/arrow:text-primary group-hover/arrow:scale-110 transition-all" />
              </div>
            </div>

            {/* Output preview */}
            {tab === 'deposit' ? (
              <OutputPreview
                amount={depositPreview}
                tokenLabel="pbEURC"
                subtext={exchangeRate > 0 ? `Yield-bearing vault shares at 1 EURC = ${(1 / exchangeRate).toFixed(4)} pbEURC` : 'Exchange rate loading...'}
                tooltip="pbEURC are yield-bearing receipt tokens. As the vault earns yield through rate arbitrage and compounding, the exchange rate grows — meaning your pbEURC shares are worth more EURC over time. No manual claiming needed."
              />
            ) : (
              <OutputPreview
                amount={parsedAmount > 0 ? parsedAmount : null}
                tokenLabel="EURC"
                subtext={`Burns ${withdrawPreview !== null ? withdrawPreview.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'} pbEURC at current exchange rate`}
                tooltip="Withdrawing burns your pbEURC shares and returns EURC at the current exchange rate. Since the rate grows over time, you receive more EURC than you originally deposited."
              />
            )}

            {/* Tx feedback */}
            {txState.status === 'success' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-300">
                    {txState.tab === 'deposit'
                      ? `Deposited ${txState.amount.toLocaleString()} EURC`
                      : `Withdrew ${txState.amount.toLocaleString()} EURC`}
                  </p>
                  {txState.txSig && (
                    <a
                      href={explorerTxUrl(txState.txSig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400/80 hover:text-emerald-300 transition-colors"
                    >
                      View on Solscan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {txState.status === 'error' && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{txState.message}</p>
              </div>
            )}

            {/* Action button */}
            {!connected ? (
              <WalletMultiButton style={WALLET_BUTTON_STYLE} />
            ) : (
              <button
                onClick={handleAction}
                disabled={!canSubmit}
                className={clsx(
                  'w-full rounded-xl py-3 text-[0.9375rem] font-semibold transition-all',
                  canSubmit
                    ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-[0.98]'
                    : 'bg-secondary/60 text-muted-foreground cursor-not-allowed opacity-70',
                )}
              >
                {txState.status === 'pending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tab === 'deposit' ? 'Depositing…' : 'Withdrawing…'}
                  </span>
                ) : !isVaultLive ? (
                  'Vault Not Deployed'
                ) : !isAmountValid && parsedAmount > 0 ? (
                  'Insufficient Balance'
                ) : tab === 'deposit' ? (
                  `Deposit ${parsedAmount > 0 ? parsedAmount.toLocaleString() + ' ' : ''}EURC`
                ) : (
                  `Withdraw ${parsedAmount > 0 ? parsedAmount.toLocaleString() + ' ' : ''}EURC`
                )}
              </button>
            )}

            {/* Fee disclosure */}
            <div className="rounded-xl border border-border bg-secondary/10 p-3.5">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    <span className="text-foreground/70 font-medium">{MGMT_FEE_BPS / 100}% management</span> (annual, on TVL) ·{' '}
                    <span className="text-foreground/70 font-medium">{PERF_FEE_BPS / 100}% performance</span> (on profits, high-water mark)
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                    No hidden fees. No lock-up penalties. Yield accrues via the pbEURC exchange rate — no manual claiming required.{' '}
                    <Link href="/docs" className="text-primary/70 hover:text-primary transition-colors">Learn more →</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Position summary (when wallet connected) */}
        {connected && userShares > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Your Position
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">pbEURC Shares</p>
                <p className="text-base font-semibold tabular-nums">
                  {userShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-base font-semibold tabular-nums text-emerald-400">
                  €{userSharesInEurc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Yield Earned</p>
                <p className="text-base font-semibold tabular-nums text-emerald-400">
                  +€{Math.max(0, (exchangeRate - 1) * userShares).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
