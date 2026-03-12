import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// calculatePoints -- Scheduled function (every 6 hours)
//
// Iterates all users, calculates time-prorated staking points with tier
// multipliers, adds referral bonus points, updates user docs, and rebuilds
// the leaderboard collection.
//
// Points formula (per calculation cycle):
//   stakingPoints = (totalStakedAmount / 100) * daysSinceLastCalc * tierMultiplier
//   referralPoints = referralCount * 500  (already awarded at sign-up, included in totalPoints)
//
// Tier thresholds (based on totalStakedAmount in EURC):
//   Bronze:  0 - 10,000       => x1.0
//   Silver:  10,000 - 25,000  => x1.2
//   Gold:    25,000 - 50,000  => x1.5
//   Diamond: 50,000+          => x2.0
// ---------------------------------------------------------------------------

type UserTier = "bronze" | "silver" | "gold" | "diamond";

interface TierThreshold {
  tier: UserTier;
  minStake: number;
  multiplier: number;
}

/** Ordered highest-first so the first match wins in determineTier. */
const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: "diamond", minStake: 50_000, multiplier: 2.0 },
  { tier: "gold", minStake: 25_000, multiplier: 1.5 },
  { tier: "silver", minStake: 10_000, multiplier: 1.2 },
  { tier: "bronze", minStake: 0, multiplier: 1.0 },
];

const POINTS_PER_100_EURC_PER_DAY = 1;
const REFERRAL_BONUS_POINTS = 500;
const BATCH_SIZE = 500;
const LEADERBOARD_COLLECTION = "leaderboard";
const USERS_COLLECTION = "users";

function determineTier(totalStaked: number): { tier: UserTier; multiplier: number } {
  for (const t of TIER_THRESHOLDS) {
    if (totalStaked >= t.minStake) {
      return { tier: t.tier, multiplier: t.multiplier };
    }
  }
  return { tier: "bronze", multiplier: 1.0 };
}

function truncateAddress(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const calculatePoints = onSchedule(
  {
    schedule: "every 6 hours",
    region: "us-central1",
    timeoutSeconds: 300,
    maxInstances: 1,
    memory: "512MiB",
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    // -- Phase 1: Calculate and update points for all users -----------------

    const usersSnap = await db.collection(USERS_COLLECTION).get();

    if (usersSnap.empty) {
      console.log("No users to process");
      return;
    }

    // Collect user data for ranking after update
    const userUpdates: {
      wallet: string;
      totalPoints: number;
      totalStaked: number;
      tier: UserTier;
      referralCount: number;
    }[] = [];

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of usersSnap.docs) {
      const user = doc.data();
      const wallet = doc.id;

      const totalStakedAmount: number = user.totalStakedAmount ?? 0;
      const referralCount: number = user.referralCount ?? 0;
      const existingPoints: number = user.totalPoints ?? 0;

      // Calculate time elapsed since last points calculation
      let daysSinceLast: number;
      if (user.lastPointsCalculation) {
        const lastMs = user.lastPointsCalculation.toMillis();
        daysSinceLast = (nowMs - lastMs) / (1000 * 60 * 60 * 24);
      } else {
        // First calculation -- assume one period (6 hours)
        daysSinceLast = 6 / 24; // 0.25 days
      }

      // Skip if no time has elapsed
      if (daysSinceLast <= 0) {
        userUpdates.push({
          wallet,
          totalPoints: existingPoints,
          totalStaked: totalStakedAmount,
          tier: determineTier(totalStakedAmount).tier,
          referralCount,
        });
        continue;
      }

      // Determine tier and multiplier based on staked amount
      const { tier, multiplier } = determineTier(totalStakedAmount);

      // Calculate new staking points for this period (with tier multiplier)
      const newStakingPoints =
        (totalStakedAmount / 100) *
        daysSinceLast *
        POINTS_PER_100_EURC_PER_DAY *
        multiplier;

      // Referral points are already awarded at sign-up via verifySignature,
      // so they are already included in the user's totalPoints. We only add
      // the new staking points earned this cycle.
      const updatedTotalPoints = existingPoints + Math.floor(newStakingPoints);

      batch.update(db.collection(USERS_COLLECTION).doc(wallet), {
        totalPoints: updatedTotalPoints,
        tier,
        lastPointsCalculation: now,
        updatedAt: now,
      });

      batchCount++;

      userUpdates.push({
        wallet,
        totalPoints: updatedTotalPoints,
        totalStaked: totalStakedAmount,
        tier,
        referralCount,
      });

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // -- Phase 2: Sort by points and assign ranks ---------------------------

    userUpdates.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign ranks (1-based, ties get same rank)
    const ranked = userUpdates.map((u, i, arr) => {
      let rank: number;
      if (i === 0) {
        rank = 1;
      } else if (u.totalPoints < arr[i - 1].totalPoints) {
        rank = i + 1;
      } else {
        // Tie -- find the rank of the previous user with the same points
        // Walk backwards to find the first user with this point total
        let j = i - 1;
        while (j > 0 && arr[j - 1].totalPoints === u.totalPoints) {
          j--;
        }
        rank = j + 1;
      }
      return { ...u, rank };
    });

    // -- Phase 3: Delete existing leaderboard docs --------------------------

    const existingLeaderboard = await db.collection(LEADERBOARD_COLLECTION).get();
    let deleteBatch = db.batch();
    let deleteCount = 0;

    for (const doc of existingLeaderboard.docs) {
      deleteBatch.delete(doc.ref);
      deleteCount++;
      if (deleteCount >= BATCH_SIZE) {
        await deleteBatch.commit();
        deleteBatch = db.batch();
        deleteCount = 0;
      }
    }
    if (deleteCount > 0) {
      await deleteBatch.commit();
    }

    // -- Phase 4: Write new leaderboard + update user ranks -----------------

    let lbBatch = db.batch();
    let lbCount = 0;

    for (const u of ranked) {
      // Write leaderboard entry
      lbBatch.set(db.collection(LEADERBOARD_COLLECTION).doc(u.wallet), {
        totalPoints: u.totalPoints,
        totalStaked: u.totalStaked,
        referralCount: u.referralCount,
        tier: u.tier,
        rank: u.rank,
        address: truncateAddress(u.wallet),
      });
      lbCount++;

      // Update user rank
      lbBatch.update(db.collection(USERS_COLLECTION).doc(u.wallet), {
        rank: u.rank,
      });
      lbCount++;

      if (lbCount >= BATCH_SIZE - 1) {
        await lbBatch.commit();
        lbBatch = db.batch();
        lbCount = 0;
      }
    }

    if (lbCount > 0) {
      await lbBatch.commit();
    }

    console.log(
      `Points calculated for ${usersSnap.size} users. Leaderboard rebuilt with ${ranked.length} entries.`,
    );
  },
);
