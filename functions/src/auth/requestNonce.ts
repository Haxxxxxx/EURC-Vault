import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { noncesCol } from "../lib/firestore";
import { REGION } from "../config";

// ---------------------------------------------------------------------------
// requestNonce -- Generate a nonce for wallet sign-in
//
// No authentication required (this is the first step of the auth flow).
// Returns { nonce } for the client to sign.
// ---------------------------------------------------------------------------

const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes

export const requestNonce = onCall(
  { region: REGION, maxInstances: 20 },
  async () => {
    try {
      const nonce = randomBytes(32).toString("hex");
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + NONCE_TTL_SECONDS * 1000),
      );

      await noncesCol().doc(nonce).set({
        walletAddress: "",
        expiresAt,
      });

      return { nonce };
    } catch (error) {
      console.error("requestNonce error:", error);
      throw new HttpsError("internal", "Failed to generate nonce");
    }
  },
);
