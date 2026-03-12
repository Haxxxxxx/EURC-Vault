import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ---------------------------------------------------------------------------
// sendPush -- Firestore trigger on notifications/{notifId} creation
//
// When a new notification document is created:
// 1. Read the recipient's user preferences
// 2. Check if the notification type is enabled in their preferences
// 3. If FCM tokens exist, send a push notification via FCM
// 4. Clean up invalid tokens on send failure
// ---------------------------------------------------------------------------

type NotificationType =
  | "epoch"
  | "reward"
  | "tx_confirmed"
  | "tx_failed"
  | "security"
  | "info";

/**
 * Maps notification type -> user preference key.
 * "info" type always sends (not gated by a preference).
 */
const TYPE_TO_PREF_KEY: Partial<Record<NotificationType, string>> = {
  epoch: "epochAlerts",
  reward: "rewardDistribution",
  tx_confirmed: "txConfirmations",
  tx_failed: "txConfirmations",
  security: "securityAlerts",
};

export const sendPush = onDocumentCreated(
  {
    document: "notifications/{notifId}",
    region: "us-central1",
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data();
    const recipientWallet: string | undefined = notification.recipientWallet;
    const type: NotificationType | undefined = notification.type;
    const title: string = notification.title ?? "";
    const body: string = notification.body ?? "";

    if (!recipientWallet) {
      console.warn("Notification missing recipientWallet:", snap.id);
      return;
    }

    // -- Look up user preferences ------------------------------------------

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(recipientWallet).get();

    if (!userSnap.exists) {
      console.warn(`User not found for notification: ${recipientWallet}`);
      return;
    }

    const user = userSnap.data()!;
    const prefs = user.preferences;

    // -- Check if notification type is enabled ------------------------------

    if (type && type !== "info") {
      const prefKey = TYPE_TO_PREF_KEY[type];
      if (prefKey) {
        const notifPrefs = prefs?.notifications as Record<string, boolean> | undefined;
        if (notifPrefs && notifPrefs[prefKey] === false) {
          console.log(
            `Notification type "${type}" disabled for ${recipientWallet}, skipping push`,
          );
          return;
        }
      }
    }

    // -- Send FCM push notification ----------------------------------------

    const fcmTokens: string[] | undefined = prefs?.fcmTokens;
    if (!fcmTokens || fcmTokens.length === 0) {
      console.log(`No FCM tokens for ${recipientWallet}, skipping push`);
      return;
    }

    const messaging = getMessaging();

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title,
          body,
        },
        data: {
          type: type ?? "info",
          notificationId: snap.id,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "eurc_vault_default",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      // -- Clean up invalid tokens ------------------------------------------

      const invalidTokens: string[] = [];

      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(fcmTokens[idx]);
          } else {
            console.warn(
              `FCM send error for token index ${idx}:`,
              resp.error.message,
            );
          }
        }
      });

      if (invalidTokens.length > 0) {
        const validTokens = fcmTokens.filter(
          (t: string) => !invalidTokens.includes(t),
        );
        await db.collection("users").doc(recipientWallet).update({
          "preferences.fcmTokens": validTokens,
        });
        console.log(
          `Removed ${invalidTokens.length} invalid FCM token(s) for ${recipientWallet}`,
        );
      }

      console.log(
        `Push sent to ${recipientWallet}: ${response.successCount} success, ${response.failureCount} failure(s)`,
      );
    } catch (error) {
      console.error(`Failed to send push to ${recipientWallet}:`, error);
    }
  },
);
