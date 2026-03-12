import { onSchedule } from "firebase-functions/v2/scheduler";
import { strategiesCol, db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import { VAULT_REGISTRY } from "../lib/types.js";
import {
  VAULT_STRATEGY_PROFILES,
  getStrategyProfile,
} from "../lib/strategyRegistry.js";
import * as logger from "firebase-functions/logger";

/**
 * Scheduled function: runs every 15 minutes.
 *
 * MVP Strategy Monitor:
 * - Reads DeFi position data from Firestore (populated manually or by future integrations)
 * - Creates time-series snapshots for charting
 * - In production, would read from Kamino/Drift/MarginFi APIs
 */
export const strategyMonitor = onSchedule(
  {
    schedule: "every 15 minutes",
    region: REGION,
    timeoutSeconds: 60,
    maxInstances: 1,
  },
  async () => {
    const now = Date.now();

    for (const profile of VAULT_STRATEGY_PROFILES) {
      try {
        // Ensure strategy documents exist for each allocation
        for (const alloc of profile.allocations) {
          const docId = `${profile.vaultId}_${alloc.protocol}_${alloc.name
            .toLowerCase()
            .replace(/\s+/g, "_")}`;
          const docRef = strategiesCol().doc(docId);
          const doc = await docRef.get();

          if (!doc.exists) {
            // Initialize strategy document
            await docRef.set({
              vaultId: profile.vaultId,
              protocol: alloc.protocol,
              status: "active",
              targetAllocationBps: alloc.targetAllocationBps,
              deployedAmount: 0,
              unrealizedPnl: 0,
              realizedPnl: 0,
              currentApy: 0,
              leverage: alloc.leverage,
              lastHarvestTime: 0,
            });
            logger.info(`Initialized strategy doc: ${docId}`);
          }

          // Create snapshot for time-series
          const data = doc.exists ? doc.data()! : {};
          await db.collection("strategy_snapshots").add({
            vaultId: profile.vaultId,
            protocol: alloc.protocol,
            name: alloc.name,
            deployedAmount: data.deployedAmount || 0,
            unrealizedPnl: data.unrealizedPnl || 0,
            realizedPnl: data.realizedPnl || 0,
            currentApy: data.currentApy || 0,
            timestamp: now,
          });
        }
      } catch (err) {
        logger.error(
          `Error monitoring strategies for vault ${profile.vaultId}:`,
          err,
        );
      }
    }

    logger.info("Strategy monitor completed");
  },
);
