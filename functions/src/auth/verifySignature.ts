import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as nacl from "tweetnacl";
import bs58 from "bs58";
import { randomBytes } from "crypto";
import { db, noncesCol, usersCol, referralsCol } from "../lib/firestore";
import { REGION } from "../config";
import type { NonceDocument, UserDocument, UserTier } from "../lib/types";

// ---------------------------------------------------------------------------
// verifySignature -- Verify a wallet signature and issue a Firebase custom token
//
// Accepts { walletAddress, signature, nonce, referralCode? }
// 1. Validates nonce exists and has not expired
// 2. Verifies ed25519 signature over "Sign in to EURC Vault\nNonce: {nonce}"
// 3. Deletes the consumed nonce
// 4. Upserts user doc (creates with defaults if new)
// 5. Handles referral code if provided and user is new
// 6. Returns { token } -- a Firebase custom token
// ---------------------------------------------------------------------------

const SIGN_IN_MESSAGE_PREFIX = "Sign in to EURC Vault\nNonce: ";
const REFERRAL_BONUS_POINTS = 500;

interface VerifySignatureRequest {
  walletAddress: string;
  signature: string;
  nonce: string;
  referralCode?: string;
}

export const verifySignature = onCall(
  { region: REGION, maxInstances: 20 },
  async (request) => {
    const { walletAddress, signature, nonce, referralCode } =
      request.data as VerifySignatureRequest;

    // -- Input validation -----------------------------------------------

    if (!walletAddress || typeof walletAddress !== "string") {
      throw new HttpsError("invalid-argument", "walletAddress is required");
    }
    if (!signature || typeof signature !== "string") {
      throw new HttpsError("invalid-argument", "signature is required");
    }
    if (!nonce || typeof nonce !== "string") {
      throw new HttpsError("invalid-argument", "nonce is required");
    }

    // Validate wallet address is a valid base58 Solana public key (32 bytes)
    let publicKeyBytes: Uint8Array;
    try {
      publicKeyBytes = bs58.decode(walletAddress);
      if (publicKeyBytes.length !== 32) {
        throw new Error("Invalid length");
      }
    } catch {
      throw new HttpsError("invalid-argument", "Invalid wallet address");
    }

    // -- Nonce verification ---------------------------------------------

    const nonceSnap = await noncesCol().doc(nonce).get();
    if (!nonceSnap.exists) {
      throw new HttpsError("not-found", "Nonce not found or already used");
    }

    const nonceData = nonceSnap.data() as NonceDocument;
    if (nonceData.expiresAt.toDate() < new Date()) {
      // Clean up expired nonce
      await noncesCol().doc(nonce).delete();
      throw new HttpsError("deadline-exceeded", "Nonce has expired");
    }

    // Delete nonce immediately (one-time use) before verification
    // to prevent replay even if verification throws
    await noncesCol().doc(nonce).delete();

    // -- Signature verification -----------------------------------------

    const message = `${SIGN_IN_MESSAGE_PREFIX}${nonce}`;
    const messageBytes = new TextEncoder().encode(message);

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signature);
    } catch {
      throw new HttpsError("invalid-argument", "Invalid signature encoding");
    }

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    if (!isValid) {
      throw new HttpsError("unauthenticated", "Signature verification failed");
    }

    // -- Upsert user doc ------------------------------------------------

    const userRef = usersCol().doc(walletAddress);
    const userSnap = await userRef.get();
    const isNewUser = !userSnap.exists;

    if (isNewUser) {
      const referralCodeForUser = generateReferralCode();

      const newUser: UserDocument = {
        totalPoints: 0,
        tier: "bronze" as UserTier,
        rank: 0,
        referralCode: referralCodeForUser,
        referredBy: null,
        referralCount: 0,
        totalStakedAmount: 0,
        preferences: {
          language: "en",
          currency: "EUR",
          notifications: {
            epochAlerts: true,
            rewardDistribution: true,
            txConfirmations: true,
            securityAlerts: true,
          },
          fcmTokens: [],
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await userRef.set(newUser);

      // Create referral code lookup
      await referralsCol().doc(referralCodeForUser).set({
        ownerWallet: walletAddress,
        usageCount: 0,
      });
    } else {
      // Existing user -- just touch updatedAt
      await userRef.update({ updatedAt: Timestamp.now() });
    }

    // -- Handle referral ------------------------------------------------

    if (referralCode && isNewUser) {
      await processReferral(walletAddress, referralCode);
    }

    // -- Issue custom token ---------------------------------------------

    try {
      const token = await getAuth().createCustomToken(walletAddress);
      return { token };
    } catch (error) {
      console.error("Failed to create custom token:", error);
      throw new HttpsError(
        "internal",
        "Failed to create authentication token",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateReferralCode(): string {
  // Format: EURC-XXXX where XXXX is 4 random uppercase alphanumeric chars
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(bytes[i] % chars.length);
  }
  return `EURC-${suffix}`;
}

async function processReferral(
  newUserWallet: string,
  code: string,
): Promise<void> {
  const referralSnap = await referralsCol().doc(code).get();
  if (!referralSnap.exists) {
    // Invalid referral code -- silently ignore, don't block sign-up
    console.warn(`Invalid referral code used: ${code}`);
    return;
  }

  const referralData = referralSnap.data()!;
  const referrerWallet = referralData.ownerWallet as string;

  // Don't allow self-referral
  if (referrerWallet === newUserWallet) {
    console.warn(`Self-referral attempt by ${newUserWallet}`);
    return;
  }

  const batch = db.batch();

  // Update referrer: increment count and award bonus points
  const referrerRef = usersCol().doc(referrerWallet);
  batch.update(referrerRef, {
    referralCount: FieldValue.increment(1),
    totalPoints: FieldValue.increment(REFERRAL_BONUS_POINTS),
    updatedAt: Timestamp.now(),
  });

  // Update referral doc usage count
  batch.update(referralsCol().doc(code), {
    usageCount: FieldValue.increment(1),
  });

  // Update new user with referredBy
  const newUserRef = usersCol().doc(newUserWallet);
  batch.update(newUserRef, {
    referredBy: referrerWallet,
  });

  await batch.commit();
}
