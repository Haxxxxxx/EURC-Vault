'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TEST_EURC_MINT, PROGRAM_ID, EURC_DECIMALS, VAULT_REGISTRY } from '@/lib/constants';
import {
  deriveVaultPdas,
  deriveUserPdas,
  buildDepositTx,
  buildFundRewardsTx,
  buildInitiateWithdrawalTx,
  buildCompleteWithdrawalTx,
  buildCancelWithdrawalTx,
} from '@/lib/devnet-tx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number;
  time: string;
  type: 'success' | 'error' | 'info';
  message: string;
  sig?: string;
}

// ---------------------------------------------------------------------------
// Account data decoder (raw bytes -> readable fields)
// ---------------------------------------------------------------------------

function decodeVaultConfig(data: Buffer) {
  // Anchor discriminator = first 8 bytes, skip it
  let offset = 8;
  const vaultId = data.readBigUInt64LE(offset); offset += 8;
  const authority = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const pendingAuth = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const eurcMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const bump = data.readUInt8(offset); offset += 1;
  const authBump = data.readUInt8(offset); offset += 1;
  const paused = data.readUInt8(offset) !== 0; offset += 1;
  // pbEURC fields
  const pbEurcMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const pbMintAuthBump = data.readUInt8(offset); offset += 1;
  const maxCapacity = data.readBigUInt64LE(offset); offset += 8;
  const totalEurcInVault = data.readBigUInt64LE(offset); offset += 8;
  const totalPbEurcSupply = data.readBigUInt64LE(offset); offset += 8;
  const totalRewardsFunded = data.readBigUInt64LE(offset); offset += 8;
  const exchangeRate = data.readBigUInt64LE(offset); // u128 but read first 8
  offset += 16; // skip full u128
  const currentEpoch = data.readBigUInt64LE(offset); offset += 8;
  const epochDuration = data.readBigInt64LE(offset); offset += 8;
  const epochStartTime = data.readBigInt64LE(offset); offset += 8;
  const withdrawalCooldown = data.readBigInt64LE(offset); offset += 8;
  const stakerCount = data.readBigUInt64LE(offset); offset += 8;

  return {
    vaultId: Number(vaultId),
    authority: authority.toBase58().slice(0, 8) + '...',
    paused,
    maxCapacity: Number(maxCapacity) / 1e6,
    totalEurcInVault: Number(totalEurcInVault) / 1e6,
    totalPbEurcSupply: Number(totalPbEurcSupply) / 1e6,
    exchangeRate: Number(exchangeRate) / 1e12,
    totalRewardsFunded: Number(totalRewardsFunded) / 1e6,
    currentEpoch: Number(currentEpoch),
    epochDuration: Number(epochDuration),
    withdrawalCooldown: Number(withdrawalCooldown),
    stakerCount: Number(stakerCount),
  };
}

function decodeUserStake(data: Buffer) {
  let offset = 8; // skip discriminator
  const vault = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const user = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const bump = data.readUInt8(offset); offset += 1;
  const pendingWithdrawalEurc = data.readBigUInt64LE(offset); offset += 8;
  const pendingWithdrawalShares = data.readBigUInt64LE(offset); offset += 8;
  const withdrawalAvailableAt = data.readBigInt64LE(offset); offset += 8;
  const lastInteractionTime = data.readBigInt64LE(offset); offset += 8;
  const firstDepositTime = data.readBigInt64LE(offset); offset += 8;

  return {
    pendingWithdrawalEurc: Number(pendingWithdrawalEurc) / 1e6,
    pendingWithdrawalShares: Number(pendingWithdrawalShares) / 1e6,
    withdrawalAvailableAt: Number(withdrawalAvailableAt),
    lastInteraction: new Date(Number(lastInteractionTime) * 1000).toLocaleTimeString(),
  };
}

// ---------------------------------------------------------------------------
// Onboarding step definitions
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS = [
  { label: 'Get SOL', number: 1 },
  { label: 'Get EURC', number: 2 },
  { label: 'Deposit', number: 3 },
  { label: 'Interact', number: 4 },
] as const;

// ---------------------------------------------------------------------------
// Action card descriptions
// ---------------------------------------------------------------------------

const getActionDescriptions = (cooldown?: number): Record<string, string> => ({
  deposit: 'Deposit EURC to receive pbEURC receipt tokens. Your share of the vault grows as the exchange rate increases. Blocked when vault is paused or at capacity.',
  fundRewards: 'Admin only — Add EURC to the vault, increasing the pbEURC exchange rate. All pbEURC holders benefit proportionally as their tokens become redeemable for more EURC.',
  initiateWithdrawal: `Burn pbEURC shares and start the ${cooldown ?? '?'}s cooldown. The EURC value is locked based on the current exchange rate. Only one pending withdrawal at a time.`,
  completeWithdrawal: 'Finalize your withdrawal after cooldown expires. Receive your EURC based on the shares burned at initiation.',
  cancelWithdrawal: 'Cancel pending withdrawal and re-mint your pbEURC shares. Shares are restored at the original amount.',
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DevnetPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [vaultId, setVaultId] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logCounter, setLogCounter] = useState(0);
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  // Form values
  const [depositAmount, setDepositAmount] = useState('100');
  const [fundAmount, setFundAmount] = useState('25');
  const [withdrawAmount, setWithdrawAmount] = useState('50');

  // On-chain state
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [vaultState, setVaultState] = useState<any>(null);
  const [stakeState, setStakeState] = useState<any>(null);
  const [loading, setLoading] = useState('');

  // ---------------------------------------------------------------------------
  // Dynamic action descriptions (uses on-chain cooldown value)
  // ---------------------------------------------------------------------------

  const actionDescriptions = useMemo(
    () => getActionDescriptions(vaultState?.withdrawalCooldown),
    [vaultState?.withdrawalCooldown],
  );

  // ---------------------------------------------------------------------------
  // Onboarding step computation
  // ---------------------------------------------------------------------------

  const currentStep = useMemo(() => {
    if (!connected) return 0;
    if (solBalance === null || solBalance < 0.01) return 1;
    if (userBalance === null || userBalance < 1) return 2;
    if (!stakeState) return 3;
    return 4;
  }, [connected, solBalance, userBalance, stakeState]);

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  const addLog = useCallback(
    (type: LogEntry['type'], message: string, sig?: string) => {
      setLogCounter((c) => {
        const id = c + 1;
        const time = new Date().toLocaleTimeString();
        setLogs((prev) => [{ id, time, type, message, sig }, ...prev].slice(0, 50));
        return id;
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Copy to clipboard
  // ---------------------------------------------------------------------------

  const copySignature = useCallback(async (sig: string) => {
    try {
      await navigator.clipboard.writeText(sig);
      setCopiedSig(sig);
      setTimeout(() => setCopiedSig(null), 2000);
    } catch {
      // fallback: ignore
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Refresh on-chain state
  // ---------------------------------------------------------------------------

  const refreshState = useCallback(async () => {
    if (!publicKey) return;

    try {
      const { vaultConfig, vaultAuthority, vaultTokenAccount } = deriveVaultPdas(vaultId);
      const { userStake, userTokenAccount } = deriveUserPdas(vaultConfig, publicKey);

      // Fetch all accounts in parallel
      const [solBal, userBal, vaultBal, vaultAcct, stakeAcct] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getTokenAccountBalance(userTokenAccount).catch(() => null),
        connection.getTokenAccountBalance(vaultTokenAccount).catch(() => null),
        connection.getAccountInfo(vaultConfig),
        connection.getAccountInfo(userStake),
      ]);

      setSolBalance(solBal / LAMPORTS_PER_SOL);
      setUserBalance(userBal ? Number(userBal.value.uiAmountString) : null);
      setVaultBalance(vaultBal ? Number(vaultBal.value.uiAmountString) : null);

      if (vaultAcct?.data) {
        try {
          setVaultState(decodeVaultConfig(Buffer.from(vaultAcct.data)));
        } catch {
          setVaultState(null);
        }
      } else {
        setVaultState(null);
      }

      if (stakeAcct?.data) {
        try {
          setStakeState(decodeUserStake(Buffer.from(stakeAcct.data)));
        } catch {
          setStakeState(null);
        }
      } else {
        setStakeState(null);
      }
    } catch (err) {
      console.warn('refreshState error:', err);
    }
  }, [connection, publicKey, vaultId]);

  // Auto-refresh on mount and after actions
  useEffect(() => {
    if (connected && publicKey) {
      refreshState();
    }
  }, [connected, publicKey, refreshState]);

  // Auto-refresh every 10 seconds when connected
  useEffect(() => {
    if (!connected || !publicKey) return;

    const interval = setInterval(() => {
      refreshState();
    }, 10_000);

    return () => clearInterval(interval);
  }, [connected, publicKey, refreshState]);

  // ---------------------------------------------------------------------------
  // Send transaction helper
  // ---------------------------------------------------------------------------

  const sendTx = useCallback(
    async (label: string, buildFn: () => any) => {
      if (!publicKey || !sendTransaction) {
        addLog('error', `${label}: Wallet not connected`);
        return;
      }

      setLoading(label);
      try {
        const tx = buildFn();
        const sig = await sendTransaction(tx, connection);
        addLog('info', `${label}: Sent, confirming...`, sig);

        await connection.confirmTransaction(sig, 'confirmed');
        addLog('success', `${label}: Confirmed`, sig);

        // Refresh state after confirmation
        await refreshState();
      } catch (err: any) {
        const msg = err?.message || String(err);
        // Parse Anchor error codes
        const match = msg.match(/0x([0-9a-f]+)/i);
        const code = match ? parseInt(match[1], 16) : null;
        const anchorErrors: Record<number, string> = {
          6000: 'Unauthorized',
          6001: 'VaultPaused',
          6002: 'VaultCapacityExceeded',
          6003: 'InsufficientBalance',
          6004: 'ZeroDeposit',
          6005: 'InsufficientShares',
          6006: 'ZeroWithdrawal',
          6007: 'NoPendingWithdrawal',
          6008: 'WithdrawalCooldownActive',
          6009: 'WithdrawalAlreadyPending',
          6010: 'ZeroRewardFund',
          6011: 'InvalidMint',
          6012: 'InvalidConfig',
          6013: 'InvalidEpochDuration',
          6014: 'EpochNotEnded',
          6015: 'MathOverflow',
          6016: 'InvalidPendingAuthority',
          6017: 'NoPendingAuthorityTransfer',
          6018: 'AuthorityTransferNotRequested',
          6019: 'EpochAlreadyAdvanced',
          6020: 'InvalidVaultId',
          6021: 'RewardConversionOverflow',
          6022: 'NoActiveStakers',
        };
        const errorName = code !== null ? anchorErrors[code] : null;
        addLog('error', `${label}: ${errorName || msg.slice(0, 150)}`);
      } finally {
        setLoading('');
      }
    },
    [publicKey, sendTransaction, connection, addLog, refreshState],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn direction="down" delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Devnet Simulator</h1>
            <p className="text-foreground-secondary mt-1">
              Test EURC Vault contract instructions on Solana devnet
            </p>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <Badge variant="info" className="animate-pulse">
                Auto-refreshing
              </Badge>
            )}
            <Badge variant={connected ? 'success' : 'error'}>
              {connected ? 'devnet' : 'disconnected'}
            </Badge>
          </div>
        </div>
      </FadeIn>

      {/* Onboarding Steps */}
      <FadeIn direction="up" delay={0.1}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {ONBOARDING_STEPS.map((step, idx) => {
              const isCompleted = currentStep > step.number;
              const isCurrent = currentStep === step.number;
              return (
                <div key={step.number} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                        ${isCompleted
                          ? 'bg-success text-white'
                          : isCurrent
                            ? 'bg-primary text-white ring-2 ring-primary/30 ring-offset-2 ring-offset-transparent'
                            : 'bg-glass border border-glass-border text-foreground-secondary'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${isCurrent ? 'text-foreground' : 'text-foreground-secondary'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < ONBOARDING_STEPS.length - 1 && (
                    <div className={`flex-1 h-px min-w-[20px] ${isCompleted ? 'bg-success' : 'bg-glass-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </FadeIn>

      {/* Vault ID Selector */}
      <FadeIn direction="up" delay={0.15}>
        <GlassCard padding="md">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-foreground-secondary shrink-0">Select Vault:</span>
            <div className="flex gap-2">
              {VAULT_REGISTRY.map((vault) => (
                <Button
                  key={vault.onChainId}
                  variant={vaultId === vault.onChainId ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setVaultId(vault.onChainId)}
                  className="min-w-[44px]"
                >
                  {vault.onChainId}
                </Button>
              ))}
            </div>
            <span className="text-xs text-foreground-secondary">
              {VAULT_REGISTRY.find((v) => v.onChainId === vaultId)?.name ?? `Vault ${vaultId}`}
            </span>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Connection Status */}
      <FadeIn direction="up" delay={0.2}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-medium">
                {connected ? `Connected: ${publicKey?.toBase58().slice(0, 8)}...${publicKey?.toBase58().slice(-4)}` : 'Wallet not connected'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-foreground-secondary">Program: </span>
                <code className="font-mono text-xs">{PROGRAM_ID.toBase58().slice(0, 12)}...</code>
              </div>
              <div>
                <span className="text-foreground-secondary">Vault ID: </span>
                <span className="font-medium">{vaultId}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Faucet */}
      <FadeIn direction="up" delay={0.25}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Devnet Faucet</h3>
            <span className="text-xs text-foreground-secondary">Fund your wallet with devnet tokens</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={loading === 'Airdrop SOL'}
              disabled={!connected}
              onClick={async () => {
                if (!publicKey) return;
                setLoading('Airdrop SOL');
                try {
                  addLog('info', 'Requesting 2 SOL airdrop...');
                  const sig = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
                  addLog('info', 'Airdrop sent, confirming...', sig);
                  await connection.confirmTransaction(sig, 'confirmed');
                  addLog('success', 'Airdrop confirmed: +2 SOL', sig);
                  await refreshState();
                } catch (err: any) {
                  addLog('error', `Airdrop failed: ${err?.message?.slice(0, 100) || String(err)}`);
                } finally {
                  setLoading('');
                }
              }}
            >
              Airdrop 2 SOL
            </Button>

            <Button
              variant="primary"
              size="sm"
              loading={loading === 'Mint EURC'}
              disabled={!connected}
              onClick={async () => {
                if (!publicKey || !sendTransaction) return;
                setLoading('Mint EURC');
                try {
                  const mintAmount = BigInt(10_000) * BigInt(10 ** EURC_DECIMALS); // 10,000 EURC
                  const ata = getAssociatedTokenAddressSync(TEST_EURC_MINT, publicKey);
                  const tx = new Transaction().add(
                    createAssociatedTokenAccountIdempotentInstruction(
                      publicKey,
                      ata,
                      publicKey,
                      TEST_EURC_MINT,
                    ),
                    createMintToInstruction(
                      TEST_EURC_MINT,
                      ata,
                      publicKey, // mint authority must be connected wallet
                      mintAmount,
                    ),
                  );
                  addLog('info', 'Minting 10,000 test EURC...');
                  const sig = await sendTransaction(tx, connection);
                  addLog('info', 'Mint tx sent, confirming...', sig);
                  await connection.confirmTransaction(sig, 'confirmed');
                  addLog('success', 'Minted 10,000 test EURC', sig);
                  await refreshState();
                } catch (err: any) {
                  const msg = err?.message || String(err);
                  if (msg.includes('0x4')) {
                    addLog('error', 'Mint failed: connected wallet is not the mint authority for TEST_EURC_MINT');
                  } else {
                    addLog('error', `Mint failed: ${msg.slice(0, 150)}`);
                  }
                } finally {
                  setLoading('');
                }
              }}
            >
              Mint 10,000 EURC
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={refreshState}
              disabled={!connected}
            >
              Refresh Balances
            </Button>
          </div>
          {connected && (
            <p className="text-xs text-foreground-secondary mt-2">
              Mint authority must match connected wallet. CLI authority: <code className="font-mono">4U5cRu...aBwNg</code>
            </p>
          )}
        </GlassCard>
      </FadeIn>

      {/* Balances + State */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FadeIn direction="up" delay={0.3}>
          <GlassCard padding="md" className="h-full">
            <h3 className="text-sm font-medium text-foreground-secondary mb-3">Wallet Balances</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">SOL</span>
                <span className="font-mono font-medium">
                  {solBalance !== null ? (
                    <AnimatedNumber value={solBalance} decimals={4} />
                  ) : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Your EURC</span>
                <span className="font-mono font-medium">
                  {userBalance !== null ? (
                    <AnimatedNumber value={userBalance} decimals={2} />
                  ) : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Vault EURC</span>
                <span className="font-mono font-medium">
                  {vaultBalance !== null ? (
                    <AnimatedNumber value={vaultBalance} decimals={2} />
                  ) : '---'}
                </span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn direction="up" delay={0.35}>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground-secondary">Vault Config</h3>
              {vaultState && (
                <Badge variant={vaultState.paused ? 'error' : 'success'}>
                  {vaultState.paused ? 'Paused' : 'Active'}
                </Badge>
              )}
            </div>
            {vaultState ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total EURC in Vault</span>
                  <span className="font-mono">
                    <AnimatedNumber value={vaultState.totalEurcInVault} decimals={2} suffix=" EURC" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Exchange Rate</span>
                  <span className="font-mono">
                    <AnimatedNumber value={vaultState.exchangeRate} decimals={6} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total pbEURC Supply</span>
                  <span className="font-mono">
                    <AnimatedNumber value={vaultState.totalPbEurcSupply} decimals={2} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Stakers</span>
                  <span className="font-mono">
                    <AnimatedNumber value={vaultState.stakerCount} decimals={0} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Epoch</span>
                  <span className="font-mono">
                    <AnimatedNumber value={vaultState.currentEpoch} decimals={0} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cooldown</span>
                  <span className="font-mono">{vaultState.withdrawalCooldown}s</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-secondary">No vault found for ID {vaultId}</p>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn direction="up" delay={0.4}>
          <GlassCard padding="md" className="h-full">
            <h3 className="text-sm font-medium text-foreground-secondary mb-3">Your Stake</h3>
            {stakeState ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span>Pending Withdrawal</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      <AnimatedNumber value={stakeState.pendingWithdrawalEurc} decimals={2} suffix=" EURC" />
                    </span>
                    {stakeState.pendingWithdrawalEurc > 0 && (
                      <Badge variant="warning">Cooldown</Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Pending Shares</span>
                  <span className="font-mono">
                    <AnimatedNumber value={stakeState.pendingWithdrawalShares} decimals={2} suffix=" pbEURC" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Action</span>
                  <span className="font-mono text-xs">{stakeState.lastInteraction}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-secondary">No stake account found</p>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {/* Actions */}
      <StaggerGrid stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deposit */}
        <StaggerItem>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Deposit</h3>
              <InfoTooltip text={actionDescriptions.deposit} />
            </div>
            <p className="text-xs text-foreground-secondary mb-3">{actionDescriptions.deposit}</p>
            <div className="flex gap-2 items-end">
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Amount (EURC)"
                className="font-mono text-sm"
              />
              <Button
                variant="primary"
                size="sm"
                loading={loading === 'Deposit'}
                disabled={!connected}
                onClick={() =>
                  sendTx('Deposit', () =>
                    buildDepositTx(publicKey!, vaultId, BigInt(Math.round(Number(depositAmount) * 1e6))),
                  )
                }
              >
                Deposit
              </Button>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Fund Rewards (Admin) */}
        <StaggerItem>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Fund Rewards</h3>
              <Badge variant="warning">Admin</Badge>
            </div>
            <p className="text-xs text-foreground-secondary mb-3">{actionDescriptions.fundRewards}</p>
            <div className="flex gap-2 items-end">
              <Input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="Amount (EURC)"
                className="font-mono text-sm"
              />
              <Button
                variant="primary"
                size="sm"
                loading={loading === 'Fund Rewards'}
                disabled={!connected}
                onClick={() =>
                  sendTx('Fund Rewards', () =>
                    buildFundRewardsTx(publicKey!, vaultId, BigInt(Math.round(Number(fundAmount) * 1e6))),
                  )
                }
              >
                Fund
              </Button>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Initiate Withdrawal */}
        <StaggerItem>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Initiate Withdrawal</h3>
              <InfoTooltip text={actionDescriptions.initiateWithdrawal} />
            </div>
            <p className="text-xs text-foreground-secondary mb-3">
              {actionDescriptions.initiateWithdrawal}
            </p>
            <div className="flex gap-2 items-end">
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount (EURC)"
                className="font-mono text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                loading={loading === 'Initiate Withdrawal'}
                disabled={!connected}
                onClick={() =>
                  sendTx('Initiate Withdrawal', () =>
                    buildInitiateWithdrawalTx(publicKey!, vaultId, BigInt(Math.round(Number(withdrawAmount) * 1e6))),
                  )
                }
              >
                Initiate
              </Button>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Complete Withdrawal */}
        <StaggerItem>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Complete Withdrawal</h3>
              <InfoTooltip text={actionDescriptions.completeWithdrawal} />
            </div>
            <p className="text-xs text-foreground-secondary mb-3">{actionDescriptions.completeWithdrawal}</p>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              loading={loading === 'Complete Withdrawal'}
              disabled={!connected}
              onClick={() =>
                sendTx('Complete Withdrawal', () => buildCompleteWithdrawalTx(publicKey!, vaultId))
              }
            >
              Complete Withdrawal
            </Button>
          </GlassCard>
        </StaggerItem>

        {/* Cancel Withdrawal */}
        <StaggerItem>
          <GlassCard padding="md" className="h-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Cancel Withdrawal</h3>
              <InfoTooltip text={actionDescriptions.cancelWithdrawal} />
            </div>
            <p className="text-xs text-foreground-secondary mb-3">{actionDescriptions.cancelWithdrawal}</p>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              loading={loading === 'Cancel Withdrawal'}
              disabled={!connected}
              onClick={() =>
                sendTx('Cancel Withdrawal', () => buildCancelWithdrawalTx(publicKey!, vaultId))
              }
            >
              Cancel Withdrawal
            </Button>
          </GlassCard>
        </StaggerItem>
      </StaggerGrid>

      {/* How It Works */}
      <FadeIn direction="up" delay={0.25}>
        <GlassCard padding="md">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer">
              <h3 className="font-medium">How it works</h3>
              <span className="text-foreground-secondary text-xs group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <div className="mt-4 space-y-4 text-sm text-foreground-secondary">
              <div>
                <h4 className="font-medium text-foreground mb-1">pbEURC Exchange Rate Model</h4>
                <p className="font-light">
                  When you deposit EURC, you receive pbEURC receipt tokens at the current exchange rate. As the vault authority funds rewards, the exchange rate grows — meaning each pbEURC becomes redeemable for more EURC over time. No manual claiming needed.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Cooldown Mechanics</h4>
                <p className="font-light">
                  When you initiate withdrawal, your pbEURC shares are burned and the equivalent EURC value (at the current exchange rate) is locked. After the cooldown period, you can complete the withdrawal to receive the EURC. Canceling re-mints the original shares.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Emergency Exit</h4>
                <p className="font-light">
                  Emergency withdrawal is always available — bypasses cooldown and vault pause. Burns all your pbEURC and returns the equivalent EURC value.
                </p>
              </div>
            </div>
          </details>
        </GlassCard>
      </FadeIn>

      {/* Transaction Log */}
      <FadeIn direction="up" delay={0.3}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Transaction Log</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-foreground-secondary py-4 text-center text-sm">
                No transactions yet. Connect your wallet and try an action above.
              </p>
            ) : (
              logs.map((log) => (
                <GlassCard key={log.id} padding="sm" className="!p-3">
                  <div className="flex items-start gap-3">
                    <Badge
                      variant={
                        log.type === 'success' ? 'success' :
                        log.type === 'error' ? 'error' :
                        'info'
                      }
                      className="shrink-0 mt-0.5"
                    >
                      {log.type === 'success' ? 'Success' :
                       log.type === 'error' ? 'Error' :
                       'Pending'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono break-all">{log.message}</p>
                      <span className="text-xs text-foreground-secondary">{log.time}</span>
                    </div>
                    {log.sig && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copySignature(log.sig!)}
                          className="!px-2 !py-1 text-xs"
                        >
                          {copiedSig === log.sig ? 'Copied!' : 'Copy'}
                        </Button>
                        <a
                          href={`https://explorer.solana.com/tx/${log.sig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Explorer
                        </a>
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
