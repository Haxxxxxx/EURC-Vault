import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// resolveReferral -- Public callable (no auth required)
//
// Accepts { code } and looks up the referral document in Firestore.
// Returns { valid: true, ownerDisplayAddress } if found, { valid: false }
// otherwise.
// ---------------------------------------------------------------------------

interface ResolveReferralRequest {
  code: string;
}

interface ResolveReferralResponse {
  valid: boolean;
  ownerDisplayAddress?: string;
}

function truncateAddress(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const resolveReferral = onCall(
  { region: "us-central1", maxInstances: 20 },
  async (request): Promise<ResolveReferralResponse> => {
    const data = request.data as ResolveReferralRequest;

    if (!data.code || typeof data.code !== "string") {
      throw new HttpsError("invalid-argument", "Referral code is required");
    }

    const code = data.code.trim().toUpperCase();

    if (code.length === 0 || code.length > 20) {
      throw new HttpsError("invalid-argument", "Invalid referral code format");
    }

    const db = getFirestore();
    const referralSnap = await db.collection("referrals").doc(code).get();

    if (!referralSnap.exists) {
      return { valid: false };
    }

    const referralData = referralSnap.data()!;

    return {
      valid: true,
      ownerDisplayAddress: truncateAddress(referralData.ownerWallet),
    };
  },
);
