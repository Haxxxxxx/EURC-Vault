import { FieldValue } from "firebase-admin/firestore";
import { PublicKey } from "@solana/web3.js";
import {
  db,
  usersCol,
  userTransactionsCol,
  epochsCol,
  notificationsCol,
} from "../lib/firestore.js";
import { PROGRAM_ID } from "../config.js";
import {
  VAULT_REGISTRY,
  type TransactionType,
  type NotificationType,
} from "../lib/types.js";
import type {
  ParsedEvent,
  ParsedDeposited,
  ParsedWithdrawalInitiated,
  ParsedWithdrawalCompleted,
  ParsedWithdrawalCancelled,
  ParsedRewardsClaimed,
  ParsedEpochAdvanced,
  ParsedRewardsFunded,
  ParsedEmergencyWithdrawalExecuted,
} from "./eventParser.js";

// ---------------------------------------------------------------------------
// Event handlers
//
// Each handler receives a parsed event, the transaction signature, and the
// block timestamp, then writes the appropriate Firestore documents:
//   - Transaction record under users/{wallet}/transactions/{sig}
//   - Notification in notifications/{id}
//   - Epoch record for EpochAdvanced events
//   - User aggregate updates (totalStakedAmount)
//
// All writes are idempotent: transaction docs use the signature as doc ID,
// notifications use a deterministic ID built from event+signature.
// ---------------------------------------------------------------------------

const EURC_DECIMALS = 6;

/** Convert base units (u64) to human-readable EURC amount */
function toEurc(amount: bigint): number {
  return Number(amount) / 10 ** EURC_DECIMALS;
}

// ---------------------------------------------------------------------------
// Vault pubkey -> registry entry resolution
// ---------------------------------------------------------------------------

const VAULT_SEED = Buffer.from("vault");

/** Cache mapping vault pubkey (base58) -> onChainId */
const vaultPubkeyToIdCache = new Map<string, number>();

/**
 * Derive the vault config PDA for a given on-chain vault ID.
 * Mirrors the PDA derivation in the Anchor program.
 */
function deriveVaultPda(vaultId: number): PublicKey {
  const programId = new PublicKey(PROGRAM_ID.value());
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(vaultId));
  const [pda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, idBuf],
    programId,
  );
  return pda;
}

/**
 * Resolve a vault pubkey to its on-chain vault ID by checking the PDA
 * derivation against the registry. Results are cached for the process lifetime.
 */
function resolveVaultId(vaultPubkey: string): number | null {
  if (vaultPubkeyToIdCache.has(vaultPubkey)) {
    return vaultPubkeyToIdCache.get(vaultPubkey)!;
  }

  for (const entry of VAULT_REGISTRY) {
    const pda = deriveVaultPda(entry.onChainId);
    if (pda.toBase58() === vaultPubkey) {
      vaultPubkeyToIdCache.set(vaultPubkey, entry.onChainId);
      return entry.onChainId;
    }
  }

  console.warn(`Unknown vault pubkey: ${vaultPubkey}`);
  return null;
}

function getVaultSlug(vaultPubkey: string): string {
  const vaultId = resolveVaultId(vaultPubkey);
  if (vaultId === null) return `vault-${vaultPubkey.slice(0, 8)}`;
  const entry = VAULT_REGISTRY.find((v) => v.onChainId === vaultId);
  return entry?.slug ?? `vault-${vaultId}`;
}

function getVaultName(vaultPubkey: string): string {
  const vaultId = resolveVaultId(vaultPubkey);
  if (vaultId === null) return "Unknown Vault";
  const entry = VAULT_REGISTRY.find((v) => v.onChainId === vaultId);
  return entry?.name ?? "Unknown Vault";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a transaction document under users/{wallet}/transactions/{sig}.
 * Returns early if the doc already exists (idempotent).
 */
async function writeTransactionDoc(params: {
  userWallet: string;
  signature: string;
  type: TransactionType;
  amount: bigint;
  vaultPubkey: string;
  blockTime: number;
}): Promise<void> {
  const { userWallet, signature, type, amount, vaultPubkey, blockTime } = params;

  const txRef = userTransactionsCol(userWallet).doc(signature);
  const existing = await txRef.get();
  if (existing.exists) return; // Already indexed

  const vaultId = resolveVaultId(vaultPubkey) ?? 0;
  const vaultSlug = getVaultSlug(vaultPubkey);
  const vaultName = getVaultName(vaultPubkey);

  await txRef.set({
    type,
    amount: toEurc(amount),
    vaultId,
    vaultSlug,
    vaultName,
    timestamp: blockTime,
    status: "CONFIRMED",
    signature,
    pointsAwarded: 0,
  });
}

/**
 * Create a notification document with a deterministic ID to prevent duplicates.
 * Uses set with merge so re-processing the same event is a no-op.
 */
async function createNotification(params: {
  recipientWallet: string;
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
}): Promise<void> {
  const { recipientWallet, type, title, body, dedupeKey } = params;
  const notifRef = notificationsCol().doc(dedupeKey);

  await notifRef.set(
    {
      recipientWallet,
      type,
      title,
      body,
      read: false,
      createdAt: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Increment or decrement the user's totalStakedAmount.
 * Creates/updates the user doc via merge to handle first-interaction cases.
 */
async function updateUserStake(
  wallet: string,
  deltaAmount: bigint,
): Promise<void> {
  const userRef = usersCol().doc(wallet);
  const eurcDelta = toEurc(deltaAmount);

  await userRef.set(
    {
      totalStakedAmount: FieldValue.increment(eurcDelta),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// ---------------------------------------------------------------------------
// Individual event handlers
// ---------------------------------------------------------------------------

async function handleDeposited(
  event: ParsedDeposited,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "DEPOSIT",
    amount: event.amount,
    vaultPubkey: event.vault,
    blockTime,
  });

  await updateUserStake(event.user, event.amount);

  await createNotification({
    recipientWallet: event.user,
    type: "tx_confirmed",
    title: "Deposit confirmed",
    body: `Your deposit of ${eurcAmount.toLocaleString()} EURC to ${vaultName} has been confirmed.`,
    dedupeKey: `tx_confirmed_deposit_${signature}`,
  });
}

async function handleWithdrawalInitiated(
  event: ParsedWithdrawalInitiated,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);
  const availableDate = new Date(Number(event.availableAt) * 1000);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "COOLDOWN_STARTED",
    amount: event.amount,
    vaultPubkey: event.vault,
    blockTime,
  });

  await createNotification({
    recipientWallet: event.user,
    type: "tx_confirmed",
    title: "Withdrawal cooldown started",
    body: `Cooldown started for ${eurcAmount.toLocaleString()} EURC from ${vaultName}. Available at ${availableDate.toISOString()}.`,
    dedupeKey: `tx_confirmed_cooldown_${signature}`,
  });
}

async function handleWithdrawalCompleted(
  event: ParsedWithdrawalCompleted,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "WITHDRAW",
    amount: event.amount,
    vaultPubkey: event.vault,
    blockTime,
  });

  // Decrease user's staked amount
  await updateUserStake(event.user, -event.amount);

  await createNotification({
    recipientWallet: event.user,
    type: "tx_confirmed",
    title: "Withdrawal completed",
    body: `Your withdrawal of ${eurcAmount.toLocaleString()} EURC from ${vaultName} is complete.`,
    dedupeKey: `tx_confirmed_withdraw_${signature}`,
  });
}

async function handleEmergencyWithdrawalExecuted(
  event: ParsedEmergencyWithdrawalExecuted,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.depositAmount);
  const vaultName = getVaultName(event.vault);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "EMERGENCY_WITHDRAW",
    amount: event.depositAmount,
    vaultPubkey: event.vault,
    blockTime,
  });

  // Decrease user's staked amount by the full deposit
  await updateUserStake(event.user, -event.depositAmount);

  await createNotification({
    recipientWallet: event.user,
    type: "security",
    title: "Emergency withdrawal executed",
    body: `Emergency withdrawal of ${eurcAmount.toLocaleString()} EURC from ${vaultName} processed.`,
    dedupeKey: `tx_confirmed_emergency_${signature}`,
  });
}

async function handleWithdrawalCancelled(
  event: ParsedWithdrawalCancelled,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "COOLDOWN_CANCELLED",
    amount: event.amount,
    vaultPubkey: event.vault,
    blockTime,
  });

  await createNotification({
    recipientWallet: event.user,
    type: "tx_confirmed",
    title: "Withdrawal cancelled",
    body: `Your pending withdrawal of ${eurcAmount.toLocaleString()} EURC from ${vaultName} has been cancelled.`,
    dedupeKey: `tx_confirmed_cancel_${signature}`,
  });
}

async function handleRewardsClaimed(
  event: ParsedRewardsClaimed,
  signature: string,
  blockTime: number,
): Promise<void> {
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);

  await writeTransactionDoc({
    userWallet: event.user,
    signature,
    type: "REWARD_CLAIM",
    amount: event.amount,
    vaultPubkey: event.vault,
    blockTime,
  });

  await createNotification({
    recipientWallet: event.user,
    type: "reward",
    title: "Rewards claimed",
    body: `You claimed ${eurcAmount.toLocaleString()} EURC in rewards from ${vaultName}.`,
    dedupeKey: `reward_claimed_${signature}`,
  });
}

async function handleEpochAdvanced(
  event: ParsedEpochAdvanced,
  signature: string,
  _blockTime: number,
): Promise<void> {
  const vaultId = resolveVaultId(event.vault);
  const vaultName = getVaultName(event.vault);
  const epochNum = Number(event.epochNumber);

  if (vaultId === null) {
    console.warn(
      `EpochAdvanced: cannot resolve vault ${event.vault}, skipping`,
    );
    return;
  }

  // Write epoch document
  const epochDocId = `${vaultId}_${epochNum}`;
  const epochRef = epochsCol().doc(epochDocId);

  await epochRef.set(
    {
      vaultId,
      epochNumber: epochNum,
      totalDeposits: toEurc(event.totalDepositsSnapshot),
      totalRewards: toEurc(event.totalRewardsDistributed),
      stakerCount: 0, // Updated separately from on-chain data
      apy: 0, // Calculated by leaderboard/calculatePoints
      startTime: 0, // Populated from on-chain vault config
      endTime: 0,
    },
    { merge: true },
  );

  // Notify all stakers with active positions
  const stakersSnap = await usersCol()
    .where("totalStakedAmount", ">", 0)
    .get();

  if (stakersSnap.empty) return;

  let batch = db.batch();
  let count = 0;
  const MAX_BATCH = 500;

  for (const userDoc of stakersSnap.docs) {
    const wallet = userDoc.id;
    const notifId = `epoch_advanced_${vaultId}_${epochNum}_${wallet}`;
    const notifRef = notificationsCol().doc(notifId);

    batch.set(
      notifRef,
      {
        recipientWallet: wallet,
        type: "epoch" as NotificationType,
        title: `${vaultName} -- Epoch ${epochNum} started`,
        body: `A new epoch has begun. Previous epoch distributed ${toEurc(event.totalRewardsDistributed).toLocaleString()} EURC in rewards.`,
        read: false,
        createdAt: Date.now(),
      },
      { merge: true },
    );

    count++;
    if (count >= MAX_BATCH) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(
    `EpochAdvanced: vault ${vaultId} epoch ${epochNum}, notified ${stakersSnap.size} stakers`,
  );
}

async function handleRewardsFunded(
  event: ParsedRewardsFunded,
  _signature: string,
  _blockTime: number,
): Promise<void> {
  // RewardsFunded is an admin/funder action. We log it but don't create
  // user-facing notifications since the funder is typically the protocol,
  // not a staker. Reward distribution notifications happen at epoch
  // advancement or when users claim rewards.
  const eurcAmount = toEurc(event.amount);
  const vaultName = getVaultName(event.vault);

  console.log(
    `RewardsFunded: ${eurcAmount} EURC funded to ${vaultName} by ${event.funder}`,
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Route a parsed event to the appropriate handler.
 */
export async function handleEvent(
  event: ParsedEvent,
  signature: string,
  blockTime: number,
): Promise<void> {
  switch (event.name) {
    case "Deposited":
      return handleDeposited(event, signature, blockTime);
    case "WithdrawalInitiated":
      return handleWithdrawalInitiated(event, signature, blockTime);
    case "WithdrawalCompleted":
      return handleWithdrawalCompleted(event, signature, blockTime);
    case "WithdrawalCancelled":
      return handleWithdrawalCancelled(event, signature, blockTime);
    case "RewardsClaimed":
      return handleRewardsClaimed(event, signature, blockTime);
    case "EpochAdvanced":
      return handleEpochAdvanced(event, signature, blockTime);
    case "RewardsFunded":
      return handleRewardsFunded(event, signature, blockTime);
    case "EmergencyWithdrawalExecuted":
      return handleEmergencyWithdrawalExecuted(event, signature, blockTime);
    case "VaultPauseToggled":
    case "AuthorityTransferInitiated":
    case "AuthorityTransferred":
      // Admin events — log only, no user-facing transactions
      console.log(`Admin event: ${event.name}`, { signature, blockTime });
      return;
    default: {
      // Exhaustive check -- TypeScript will error if a case is missed
      const _exhaustive: never = event;
      console.warn(`Unhandled event type: ${(_exhaustive as any).name}`);
    }
  }
}
