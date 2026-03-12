import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// updatePreferences -- Authenticated callable
//
// Merges partial preference updates into the user's preferences sub-document.
// Validates language, currency, and notification fields.
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = ["en", "fr", "de", "es", "pt"] as const;
const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

interface UserPreferences {
  language?: SupportedLanguage;
  currency?: SupportedCurrency;
  notifications?: Record<string, boolean>;
}

interface UpdatePreferencesRequest {
  preferences: Partial<UserPreferences>;
}

export const updatePreferences = onCall(
  { region: "us-central1", maxInstances: 20 },
  async (request) => {
    // -- Auth check ---------------------------------------------------------

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const wallet = request.auth.uid;
    const data = request.data as UpdatePreferencesRequest;

    if (!data.preferences || typeof data.preferences !== "object") {
      throw new HttpsError("invalid-argument", "preferences object is required");
    }

    const { language, currency, notifications } = data.preferences;

    // -- Validate inputs ----------------------------------------------------

    if (language !== undefined) {
      if (
        typeof language !== "string" ||
        !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)
      ) {
        throw new HttpsError(
          "invalid-argument",
          `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
        );
      }
    }

    if (currency !== undefined) {
      if (
        typeof currency !== "string" ||
        !(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)
      ) {
        throw new HttpsError(
          "invalid-argument",
          `Unsupported currency. Must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
        );
      }
    }

    if (notifications !== undefined) {
      if (typeof notifications !== "object" || notifications === null || Array.isArray(notifications)) {
        throw new HttpsError(
          "invalid-argument",
          "notifications must be an object with boolean values",
        );
      }

      for (const [key, val] of Object.entries(notifications)) {
        if (typeof val !== "boolean") {
          throw new HttpsError(
            "invalid-argument",
            `notifications.${key} must be a boolean value`,
          );
        }
      }
    }

    // -- Build update object ------------------------------------------------

    const db = getFirestore();
    const userRef = db.collection("users").doc(wallet);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (language !== undefined) {
      updateData["preferences.language"] = language;
    }

    if (currency !== undefined) {
      updateData["preferences.currency"] = currency;
    }

    if (notifications !== undefined) {
      for (const [key, val] of Object.entries(notifications)) {
        updateData[`preferences.notifications.${key}`] = val;
      }
    }

    // -- Write to Firestore -------------------------------------------------

    await userRef.update(updateData);

    return { success: true };
  },
);
