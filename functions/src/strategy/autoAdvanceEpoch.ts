import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, type Wallet } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import { getConnection } from "../lib/solana.js";
import { db, strategiesCol } from "../lib/firestore.js";
import {
  loadKeypair,
  signAndSendTransaction,
} from "../lib/transactionSigner.js";
import { PROGRAM_ID, REGION } from "../config.js";
import { VAULT_REGISTRY } from "../lib/types.js";
import { getStrategyProfile } from "../lib/strategyRegistry.js";
import * as logger from "firebase-functions/logger";

const VAULT_AUTHORITY_KEYPAIR = defineSecret("VAULT_AUTHORITY_KEYPAIR");

/**
 * Scheduled function: runs every 5 minutes.
 * For each vault, checks if the current epoch has ended.
 * If so: reads strategy P&L from Firestore → fundRewards → advanceEpoch.
 */
export const autoAdvanceEpoch = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    secrets: [VAULT_AUTHORITY_KEYPAIR],
    timeoutSeconds: 120,
    maxInstances: 1,
  },
  async () => {
    const connection = getConnection();
    const authority = loadKeypair(VAULT_AUTHORITY_KEYPAIR.value());
    const programId = new PublicKey(PROGRAM_ID.value());
    const now = Math.floor(Date.now() / 1000);

    // Minimal wallet wrapper for AnchorProvider
    const wallet: Wallet = {
      publicKey: authority.publicKey,
      signTransaction: async (tx) => {
        if (tx instanceof Transaction) tx.partialSign(authority);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach((tx) => { if (tx instanceof Transaction) tx.partialSign(authority); });
        return txs;
      },
      payer: authority,
    };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Dynamically load IDL to build program
    let sdkModule: any;
    try {
      sdkModule = await import("@eurc-vault/sdk" as any);
    } catch {
      // Fallback: the SDK may not be bundled with functions
      // In production, we'd use the Anchor coder directly
      logger.warn("SDK not available in Cloud Functions — skipping epoch check");
      return;
    }

    for (const vaultEntry of VAULT_REGISTRY) {
      try {
        const { EurcVaultClient } = sdkModule;
        const client = new EurcVaultClient(connection, wallet, programId);

        const config = await client.getVaultConfigOrNull(vaultEntry.onChainId);
        if (!config) {
          logger.info(`Vault ${vaultEntry.onChainId} not deployed — skipping`);
          continue;
        }

        const epochStartTime = config.epochStartTime.toNumber();
        const epochDuration = config.epochDuration.toNumber();
        const epochEnd = epochStartTime + epochDuration;

        if (now < epochEnd) {
          logger.info(
            `Vault ${vaultEntry.name}: epoch ${config.currentEpoch.toNumber()} has ${epochEnd - now}s remaining`,
          );
          continue;
        }

        logger.info(`Vault ${vaultEntry.name}: epoch expired, processing...`);

        // Read strategy P&L from Firestore for yield to fund
        const profile = getStrategyProfile(vaultEntry.onChainId);
        let yieldAmount = 0;

        if (profile) {
          const strategiesSnap = await strategiesCol()
            .where("vaultId", "==", vaultEntry.onChainId)
            .where("status", "==", "active")
            .get();

          for (const doc of strategiesSnap.docs) {
            const data = doc.data();
            yieldAmount += data.realizedPnl || 0;
          }
        }

        // Fund rewards if there's yield to distribute
        if (yieldAmount > 0) {
          try {
            const fundTx = await client.fundRewards(vaultEntry.onChainId, {
              amount: yieldAmount,
            });
            await signAndSendTransaction(
              fundTx,
              authority,
              `auto:fundRewards:${vaultEntry.slug}:${yieldAmount}`,
            );
            logger.info(
              `Funded ${yieldAmount} base units to vault ${vaultEntry.name}`,
            );

            // Reset realized PnL
            const batch = db.batch();
            const strategiesSnap = await strategiesCol()
              .where("vaultId", "==", vaultEntry.onChainId)
              .get();
            for (const doc of strategiesSnap.docs) {
              batch.update(doc.ref, { realizedPnl: 0 });
            }
            await batch.commit();
          } catch (err) {
            logger.error(
              `Failed to fund rewards for vault ${vaultEntry.name}:`,
              err,
            );
          }
        }

        // Advance epoch
        try {
          const advanceTx = await client.advanceEpoch(vaultEntry.onChainId);
          const sig = await signAndSendTransaction(
            advanceTx,
            authority,
            `auto:advanceEpoch:${vaultEntry.slug}:${config.currentEpoch.toNumber()}`,
          );
          logger.info(
            `Advanced epoch for vault ${vaultEntry.name}: sig=${sig}`,
          );

          // Log epoch document
          await db.collection("epochs").add({
            vaultId: vaultEntry.onChainId,
            epochNumber: config.currentEpoch.toNumber(),
            totalDeposits: config.totalDeposits.toNumber(),
            totalRewards: yieldAmount,
            stakerCount: config.stakerCount.toNumber(),
            apy: 0, // Will be calculated in strategyMonitor
            startTime: epochStartTime,
            endTime: now,
            advancedBy: "auto",
            signature: sig,
          });
        } catch (err) {
          logger.error(
            `Failed to advance epoch for vault ${vaultEntry.name}:`,
            err,
          );
        }
      } catch (err) {
        logger.error(`Error processing vault ${vaultEntry.name}:`, err);
      }
    }
  },
);
