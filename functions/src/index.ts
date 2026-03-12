import { initializeApp } from "firebase-admin/app";

// ---------------------------------------------------------------------------
// EURC Vault -- Firebase Cloud Functions (v2)
//
// Initialize Admin SDK once, then re-export all function handlers.
// All exports must be top-level for Firebase to discover them.
// ---------------------------------------------------------------------------

initializeApp();

// Auth
export { requestNonce } from "./auth/requestNonce.js";
export { verifySignature } from "./auth/verifySignature.js";

// Indexer
export { pollTransactions } from "./indexer/pollTransactions.js";
export { checkEpochTransition } from "./indexer/checkEpochTransition.js";

// Leaderboard
export { calculatePoints } from "./leaderboard/calculatePoints.js";

// Users
export { updatePreferences } from "./users/updatePreferences.js";
export { getTransactions } from "./users/getTransactions.js";
export { registerFcmToken } from "./users/registerFcmToken.js";

// Notifications
export { sendPush } from "./notifications/sendPush.js";

// Referrals
export { resolveReferral } from "./referrals/resolve.js";

// Faucet
export { mintTestEurc } from "./faucet/mintTestEurc.js";

// Strategy / Automation
export { autoAdvanceEpoch } from "./strategy/autoAdvanceEpoch.js";
export { strategyMonitor } from "./strategy/strategyMonitor.js";
export { manualFundRewards } from "./strategy/manualFundRewards.js";

// Ranger Earn — EURC Cross-Protocol Yield Optimizer
export { rangerFetchRates } from "./ranger/fetchRates.js";
export { rangerCheckRebalance } from "./ranger/checkRebalance.js";
export { rangerCompound } from "./ranger/compound.js";
export { rangerHealthCheck } from "./ranger/healthCheck.js";
export { rangerSnapMetrics } from "./ranger/snapMetrics.js";
