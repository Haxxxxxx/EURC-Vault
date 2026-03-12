import { onSchedule } from "firebase-functions/v2/scheduler";
import { PublicKey } from "@solana/web3.js";
import { FieldPath } from "firebase-admin/firestore";
import {
  db,
  notificationsCol,
  usersCol,
} from "../lib/firestore.js";
import { PROGRAM_ID } from "../config.js";
import { getConnection } from "../lib/solana.js";
import { VAULT_REGISTRY, type NotificationType } from "../lib/types.js";

// ---------------------------------------------------------------------------
// checkEpochTransition -- Scheduled function (every 5 minutes)
//
// For each vault in the registry:
//   1. Reads the on-chain vault config to get epoch timing
//   2. If the current epoch ends within 1 hour, creates epoch_alert
//      notifications for all stakers
//
// Deduplication: notification doc IDs are deterministic based on vault,
// epoch number, and a 5-minute time bucket, so repeated runs within the
// same window don't create duplicate notifications.
// ---------------------------------------------------------------------------

const EPOCH_ALERT_WINDOW_SECONDS = 60 * 60; // 1 hour before epoch end

const VAULT_SEED = Buffer.from("vault");

// VaultConfig account layout offsets (after 8-byte Anchor discriminator):
//   vault_id:                       u64   offset 8   (8 bytes)
//   authority:                      Pubkey offset 16  (32 bytes)
//   pending_authority:              Pubkey offset 48  (32 bytes)
//   eurc_mint:                      Pubkey offset 80  (32 bytes)
//   bump:                           u8    offset 112  (1 byte)
//   authority_bump:                 u8    offset 113  (1 byte)
//   paused:                         bool  offset 114  (1 byte)
//   max_capacity:                   u64   offset 115  (8 bytes)
//   total_deposits:                 u64   offset 123  (8 bytes)
//   total_rewards_distributed:      u64   offset 131  (8 bytes)
//   accumulated_reward_per_share:   u128  offset 139  (16 bytes)
//   current_epoch:                  u64   offset 155  (8 bytes)
//   epoch_duration:                 i64   offset 163  (8 bytes)
//   epoch_start_time:               i64   offset 171  (8 bytes)
//   withdrawal_cooldown:            i64   offset 179  (8 bytes)
//   staker_count:                   u64   offset 187  (8 bytes)
const OFFSET_CURRENT_EPOCH = 155;
const OFFSET_EPOCH_DURATION = 163;
const OFFSET_EPOCH_START_TIME = 171;

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

export const checkEpochTransition = onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 120,
    maxInstances: 1,
    memory: "256MiB",
    region: "us-central1",
  },
  async () => {
    const connection = getConnection();
    const nowUnix = Math.floor(Date.now() / 1000);

    for (const vault of VAULT_REGISTRY) {
      try {
        const vaultPda = deriveVaultPda(vault.onChainId);
        const accountInfo = await connection.getAccountInfo(vaultPda);

        if (!accountInfo || !accountInfo.data) {
          // Vault not deployed yet -- skip
          continue;
        }

        const data = accountInfo.data;

        if (data.length < OFFSET_EPOCH_START_TIME + 8) {
          console.warn(
            `checkEpochTransition: vault ${vault.slug} account data too short (${data.length} bytes)`,
          );
          continue;
        }

        const currentEpoch = Number(
          data.readBigUInt64LE(OFFSET_CURRENT_EPOCH),
        );
        const epochDuration = Number(
          data.readBigInt64LE(OFFSET_EPOCH_DURATION),
        );
        const epochStartTime = Number(
          data.readBigInt64LE(OFFSET_EPOCH_START_TIME),
        );

        const epochEndTime = epochStartTime + epochDuration;
        const timeUntilEnd = epochEndTime - nowUnix;

        // Only alert if the epoch ends within the alert window and hasn't
        // already ended
        if (timeUntilEnd <= 0 || timeUntilEnd > EPOCH_ALERT_WINDOW_SECONDS) {
          continue;
        }

        // Check if we already sent notifications in this 5-minute window
        // by looking for an existing doc with our deterministic prefix
        const timeBucket = Math.floor(nowUnix / (5 * 60));
        const dedupePrefix = `epoch_soon_${vault.onChainId}_${currentEpoch}_${timeBucket}`;

        const existingNotif = await notificationsCol()
          .where(
            FieldPath.documentId(),
            ">=",
            dedupePrefix,
          )
          .where(
            FieldPath.documentId(),
            "<",
            dedupePrefix + "\uf8ff",
          )
          .limit(1)
          .get();

        if (!existingNotif.empty) {
          console.log(
            `checkEpochTransition: already notified for ${vault.slug} epoch ${currentEpoch} in this time bucket`,
          );
          continue;
        }

        await notifyStakers(
          vault.slug,
          vault.name,
          vault.onChainId,
          currentEpoch,
          timeUntilEnd,
        );
      } catch (error: unknown) {
        console.error(
          `checkEpochTransition: error checking vault ${vault.slug}:`,
          error,
        );
        // Continue checking other vaults
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Notify all stakers about an upcoming epoch transition
// ---------------------------------------------------------------------------

async function notifyStakers(
  vaultSlug: string,
  vaultName: string,
  vaultId: number,
  epochNumber: number,
  timeUntilEnd: number,
): Promise<void> {
  const minutesLeft = Math.round(timeUntilEnd / 60);

  // Query all users with active stakes
  const stakersSnap = await usersCol()
    .where("totalStakedAmount", ">", 0)
    .get();

  if (stakersSnap.empty) return;

  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  let batchCount = 0;
  let batch = db.batch();
  const MAX_BATCH_SIZE = 500;

  for (const userDoc of stakersSnap.docs) {
    const wallet = userDoc.id;

    // Check if user has epoch alerts enabled
    const userData = userDoc.data() as Record<string, any>;
    const prefs = userData?.preferences;
    if (prefs?.notifications && prefs.notifications.epochAlerts === false) {
      continue;
    }

    // Deterministic doc ID: vault + epoch + wallet + time bucket
    const notifId = `epoch_soon_${vaultId}_${epochNumber}_${timeBucket}_${wallet}`;
    const notifRef = notificationsCol().doc(notifId);

    batch.set(
      notifRef,
      {
        recipientWallet: wallet,
        type: "epoch" as NotificationType,
        title: `${vaultName} -- Epoch ending soon`,
        body: `The current epoch ends in approximately ${minutesLeft} minutes. Ensure your position is set.`,
        read: false,
        createdAt: Date.now(),
      },
      { merge: true },
    );

    batchCount++;

    // Firestore batch limit is 500 operations
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(
    `checkEpochTransition: created epoch alerts for ${vaultSlug} epoch ${epochNumber} -- ${stakersSnap.size} users, ~${minutesLeft}min remaining`,
  );
}
