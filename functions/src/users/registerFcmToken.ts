import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// registerFcmToken -- Authenticated callable
//
// Registers an FCM push token for the authenticated user by appending it
// to the user's preferences.fcmTokens array (deduped via arrayUnion).
// ---------------------------------------------------------------------------

interface RegisterFcmTokenRequest {
  token: string;
}

export const registerFcmToken = onCall(
  { region: "us-central1", maxInstances: 20 },
  async (request) => {
    // -- Auth check ---------------------------------------------------------

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const wallet = request.auth.uid;
    const data = request.data as RegisterFcmTokenRequest;

    // -- Validate inputs ----------------------------------------------------

    if (!data.token || typeof data.token !== "string" || data.token.trim().length === 0) {
      throw new HttpsError("invalid-argument", "A non-empty FCM token string is required");
    }

    const token = data.token.trim();

    // -- Write to Firestore -------------------------------------------------

    const db = getFirestore();
    const userRef = db.collection("users").doc(wallet);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    await userRef.update({
      "preferences.fcmTokens": FieldValue.arrayUnion(token),
    });

    return { success: true };
  },
);
