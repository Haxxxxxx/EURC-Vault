import { onSchedule } from "firebase-functions/v2/scheduler";
import { PublicKey } from "@solana/web3.js";
import { FieldValue } from "firebase-admin/firestore";
import { db, indexerStateCol } from "../lib/firestore.js";
import { PROGRAM_ID } from "../config.js";
import { getConnection } from "../lib/solana.js";
import type { IndexerStateDocument } from "../lib/types.js";
import { parseEventsFromLogs } from "./eventParser.js";
import { handleEvent } from "./eventHandlers.js";

// ---------------------------------------------------------------------------
// pollTransactions -- Scheduled function (every 30s)
//
// Polls the Solana RPC for new transactions involving the program, parses
// Anchor events from log messages, and dispatches them to event handlers
// that write indexed data to Firestore.
//
// Concurrency guard: uses a Firestore transaction on indexer_state/main
// to prevent overlapping runs from processing the same signatures.
//
// Idempotency: event handlers check for existing docs before writing.
// ---------------------------------------------------------------------------

const INDEXER_STATE_ID = "main";
const MAX_SIGNATURES_PER_POLL = 100;

export const pollTransactions = onSchedule(
  {
    schedule: "* * * * *",
    timeoutSeconds: 60,
    maxInstances: 1,
    memory: "256MiB",
    region: "us-central1",
  },
  async () => {
    const connection = getConnection();
    const programId = new PublicKey(PROGRAM_ID.value());
    const stateRef = indexerStateCol().doc(INDEXER_STATE_ID);

    // -- Acquire lock via Firestore transaction ------------------------------

    let lastSignature: string | null | undefined;

    try {
      lastSignature = await db.runTransaction(async (txn) => {
        const stateSnap = await txn.get(stateRef);

        if (stateSnap.exists) {
          const state = stateSnap.data() as IndexerStateDocument;

          // If another instance is already running, bail out
          if (state.status === "running") {
            console.log("pollTransactions: another instance is running, skipping");
            return undefined;
          }

          txn.update(stateRef, {
            status: "running",
            updatedAt: FieldValue.serverTimestamp(),
          });

          return state.lastProcessedSignature;
        }

        // Cold start: create the state doc and start fresh
        txn.set(stateRef, {
          lastProcessedSignature: null,
          lastProcessedSlot: 0,
          status: "running",
          updatedAt: FieldValue.serverTimestamp(),
        });

        return null;
      });
    } catch (err: unknown) {
      console.error("pollTransactions: failed to acquire lock:", err);
      return;
    }

    // Transaction returned undefined when another instance is running
    if (lastSignature === undefined) return;

    try {
      // -- Fetch new signatures ---------------------------------------------

      const sigOptions: {
        limit: number;
        until?: string;
      } = { limit: MAX_SIGNATURES_PER_POLL };

      if (lastSignature) {
        sigOptions.until = lastSignature;
      }

      const signatures = await connection.getSignaturesForAddress(
        programId,
        sigOptions,
      );

      if (signatures.length === 0) {
        await stateRef.update({
          status: "idle",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      console.log(
        `pollTransactions: fetched ${signatures.length} signatures (since ${lastSignature ?? "genesis"})`,
      );

      // Process oldest first (RPC returns newest-first)
      const sortedSigs = [...signatures].reverse();

      let latestSignature = lastSignature;
      let latestSlot = 0;
      let processedCount = 0;
      let errorCount = 0;

      for (const sigInfo of sortedSigs) {
        // Skip failed transactions
        if (sigInfo.err) continue;

        const sig = sigInfo.signature;

        try {
          const tx = await connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          });

          if (!tx || !tx.meta) {
            console.warn(`pollTransactions: no data for tx ${sig}`);
            continue;
          }

          const logs = tx.meta.logMessages ?? [];
          const events = parseEventsFromLogs(logs);

          if (events.length > 0) {
            const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);

            for (const event of events) {
              await handleEvent(event, sig, blockTime);
            }

            processedCount += events.length;
          }
        } catch (err: unknown) {
          console.error(`pollTransactions: error processing tx ${sig}:`, err);
          errorCount++;
          // Continue processing remaining transactions -- don't let one
          // bad tx block the entire indexer
        }

        // Always advance the cursor past this signature, even if processing
        // failed, to avoid getting stuck in a retry loop on a permanently
        // unprocessable transaction
        latestSignature = sig;
        latestSlot = Math.max(latestSlot, sigInfo.slot);
      }

      // -- Update indexer state ----------------------------------------------

      await stateRef.update({
        lastProcessedSignature: latestSignature,
        lastProcessedSlot: latestSlot,
        status: "idle",
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `pollTransactions: done -- ${processedCount} events processed, ${errorCount} errors, cursor at ${latestSignature}`,
      );
    } catch (error: unknown) {
      console.error("pollTransactions: fatal error:", error);

      // Release the lock so the next invocation can run
      try {
        await stateRef.update({
          status: "error",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (updateErr: unknown) {
        console.error("pollTransactions: failed to update error status:", updateErr);
      }
    }
  },
);
