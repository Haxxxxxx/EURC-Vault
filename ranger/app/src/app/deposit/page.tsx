'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Navbar } from '@/components/layout/Navbar';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { VAULT_ADDRESS, EURC_MINT, EURC_PRECISION } from '@/lib/constants';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'deposit' | 'withdraw';

type TxState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; txSig: string; amount: number; tab: Tab }
  | { status: 'error'; message: string };

// ─── Demo / mock vault state ─────────────────────────────────────────────────
// These values represent the vault after ~4 months of operation at ~9.4% APY.
// Replace with on-chain reads once VAULT_ADDRESS is configured.

/** pbEURC shares per EURC deposited at current exchange rate */
const DEMO_EXCHANGE_RATE = 1.0312; // 1 EURC → 0.9697 pbEURC (rate has grown from 1.0)

/** Mock user balances — replace with real token account reads */
const DEMO_EURC_BALANCE  = 500.0;         // EURC available to deposit
const DEMO_SHARES        = 1_950.5;       // pbEURC shares currently held
const DEMO_TVL           = 847_200;       // vault TVL in EURC
const DEMO_MGMT_FEE_BPS  = 50;           // 0.5% annual
const DEMO_PERF_FEE_BPS  = 1_000;        // 10% on profit

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
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
        <span className="flex-1 text-2xl font-bold tabular-nums text-muted-foreground">
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
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { metrics, loading: metricsLoading } = useRangerMetrics();

  const [tab, setTab]       = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  // On-chain balances (live when vault is deployed + wallet connected)
  const [eurcBalance,  setEurcBalance]  = useState<number>(DEMO_EURC_BALANCE);
  const [userShares,   setUserShares]   = useState<number>(DEMO_SHARES);
  const [exchangeRate, setExchangeRate] = useState<number>(DEMO_EXCHANGE_RATE);
  const [lpPreviewShares, setLpPreviewShares] = useState<number | null>(null);

  const isVaultLive = Boolean(VAULT_ADDRESS);

  // Fetch on-chain balances when wallet connects + vault is live
  useEffect(() => {
    if (!connected || !publicKey || !isVaultLive) return;

    const fetchBalances = async () => {
      try {
        const client      = new VoltrClient(connection);
        const vaultPubkey = new PublicKey(VAULT_ADDRESS);

        // EURC balance
        const { vaultLpMint } = client.findVaultAddresses(vaultPubkey);
        const eurcAta = PublicKey.findProgramAddressSync(
          [publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), EURC_MINT.toBuffer()],
          ASSOCIATED_TOKEN_PROGRAM_ID,
        )[0];
        const lpAta = PublicKey.findProgramAddressSync(
          [publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), vaultLpMint.toBuffer()],
          ASSOCIATED_TOKEN_PROGRAM_ID,
        )[0];

        const [eurcInfo, lpInfo] = await Promise.all([
          connection.getTokenAccountBalance(eurcAta).catch(() => null),
          connection.getTokenAccountBalance(lpAta).catch(() => null),
        ]);

        if (eurcInfo) setEurcBalance(parseFloat(eurcInfo.value.uiAmountString ?? '0'));
        if (lpInfo)   setUserShares(parseFloat(lpInfo.value.uiAmountString ?? '0'));

        // Exchange rate from vault TVL / LP supply
        const positionData = await client.getPositionAndTotalValuesForVault(vaultPubkey).catch(() => null);
        if (positionData?.totalValue) {
          const lpMintInfo = await connection.getTokenSupply(vaultLpMint).catch(() => null);
          if (lpMintInfo && parseFloat(lpMintInfo.value.uiAmountString ?? '0') > 0) {
            const rate = parseFloat(positionData.totalValue.toString()) /
              EURC_PRECISION /
              parseFloat(lpMintInfo.value.uiAmountString!);
            setExchangeRate(rate > 0 ? rate : DEMO_EXCHANGE_RATE);
          }
        }
      } catch {
        // Silently fall back to demo values on RPC error
      }
    };

    void fetchBalances();
  }, [connected, publicKey, isVaultLive, connection]);

  // Recalculate LP preview when amount changes
  useEffect(() => {
    if (!isVaultLive || tab !== 'deposit') { setLpPreviewShares(null); return; }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setLpPreviewShares(null); return; }

    const fetchPreview = async () => {
      try {
        const client = new VoltrClient(connection);
        const atoms  = new BN(Math.floor(parsed * EURC_PRECISION));
        const lp     = await client.calculateLpTokensForDeposit(atoms, new PublicKey(VAULT_ADDRESS));
        setLpPreviewShares(lp.toNumber() / EURC_PRECISION);
      } catch {
        // Fall back to exchange-rate math
        setLpPreviewShares(parsed / exchangeRate);
      }
    };

    void fetchPreview();
  }, [amount, tab, isVaultLive, connection, exchangeRate]);

  // Reset form when switching tabs
  useEffect(() => {
    setAmount('');
    setTxState({ status: 'idle' });
    setLpPreviewShares(null);
  }, [tab]);

  const currentApy       = metrics?.currentApyPct ?? 9.4;
  const tvl              = metrics?.tvlEurc        ?? DEMO_TVL;
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

  const canSubmit = connected && isAmountValid && txState.status !== 'pending';

  const handleAction = useCallback(async () => {
    if (!canSubmit || !publicKey) return;

    setTxState({ status: 'pending' });

    try {
      if (!isVaultLive) {
        // Demo mode — simulate a delay and show success
        await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
        setTxState({ status: 'success', txSig: 'demo_tx_stub', amount: parsedAmount, tab });
        setAmount('');
        return;
      }

      // Live mode — real VoltrClient transactions
      const client      = new VoltrClient(connection);
      const vaultPubkey = new PublicKey(VAULT_ADDRESS);

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
        const lpAtoms = new BN(Math.floor((withdrawPreview ?? 0) * EURC_PRECISION));
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
      const tx    = new Transaction().add(ix);
      const txSig = await sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction(
        { signature: txSig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      setTxState({ status: 'success', txSig, amount: parsedAmount, tab });
      setAmount('');
      setLpPreviewShares(null);
    } catch (err) {
      setTxState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Transaction failed',
      });
    }
  }, [canSubmit, publicKey, parsedAmount, tab, isVaultLive, connection, sendTransaction, withdrawPreview]);

  function formatTvl(v: number) {
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)     return `€${(v / 1_000).toFixed(1)}K`;
    return `€${v.toFixed(0)}`;
  }

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

        {/* Demo-mode banner */}
        {!isVaultLive && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-300">Demo Mode</p>
              <p className="mt-0.5 text-xs text-yellow-400/80">
                The vault is not yet deployed. Transactions are simulated for demonstration.
                Set <code className="font-mono">NEXT_PUBLIC_VAULT_ADDRESS</code> to enable live mode.
              </p>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/10">

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
                value={formatTvl(tvl)}
                loading={metricsLoading}
              />
              <div className="h-8 w-px bg-border" />
              <StatPill
                label="Exchange Rate"
                value={`1 : ${exchangeRate.toFixed(4)}`}
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
            <div className="flex items-center justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary">
                <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* Output preview */}
            {tab === 'deposit' ? (
              <OutputPreview
                amount={depositPreview}
                tokenLabel="pbEURC"
                subtext={`Yield-bearing vault shares at 1 EURC = ${(1 / exchangeRate).toFixed(4)} pbEURC`}
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
                  {txState.txSig !== 'demo_tx_stub' && (
                    <a
                      href={`https://solscan.io/tx/${txState.txSig}`}
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
              <WalletMultiButton
                style={{
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
                }}
              />
            ) : (
              <button
                onClick={handleAction}
                disabled={!canSubmit}
                className={clsx(
                  'w-full rounded-xl py-3 text-[0.9375rem] font-semibold transition-all',
                  canSubmit
                    ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-[0.98]'
                    : 'bg-secondary text-muted-foreground cursor-not-allowed',
                )}
              >
                {txState.status === 'pending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tab === 'deposit' ? 'Depositing…' : 'Withdrawing…'}
                  </span>
                ) : !isVaultLive ? (
                  'Try Demo Deposit'
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
            <div className="flex items-start gap-2 pt-1">
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                {DEMO_MGMT_FEE_BPS / 100}% annual management fee ·{' '}
                {DEMO_PERF_FEE_BPS / 100}% performance fee on profits (high-water mark) ·
                Yield is accrued via the pbEURC exchange rate — no manual claiming required.
              </p>
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
                  +€{((exchangeRate - 1) * userShares).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
