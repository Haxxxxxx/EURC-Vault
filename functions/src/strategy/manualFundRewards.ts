import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConnection } from "../lib/solana.js";
import {
  loadKeypair,
  signAndSendTransaction,
} from "../lib/transactionSigner.js";
import { PROGRAM_ID, REGION } from "../config.js";
import { VAULT_REGISTRY } from "../lib/types.js";
import * as logger from "firebase-functions/logger";

const VAULT_AUTHORITY_KEYPAIR = defineSecret("VAULT_AUTHORITY_KEYPAIR");

/**
 * Callable function: manually fund rewards for a vault.
 * Used by admin when they want to trigger reward funding from the backend
 * without connecting their authority wallet to the web app.
 */
export const manualFundRewards = onCall(
  {
    region: REGION,
    secrets: [VAULT_AUTHORITY_KEYPAIR],
    maxInstances: 2,
  },
  async (request) => {
    // -- Auth check ---------------------------------------------------------
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { vaultId, amount } = request.data as {
      vaultId?: number;
      amount?: number;
    };

    if (!vaultId || typeof vaultId !== "number") {
      throw new HttpsError("invalid-argument", "vaultId is required");
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "amount must be a positive number (in base units)",
      );
    }

    const vaultEntry = VAULT_REGISTRY.find((v) => v.onChainId === vaultId);
    if (!vaultEntry) {
      throw new HttpsError("not-found", `Vault with ID ${vaultId} not found`);
    }

    const connection = getConnection();
    const authority = loadKeypair(VAULT_AUTHORITY_KEYPAIR.value());
    const programId = new PublicKey(PROGRAM_ID.value());

    try {
      // Dynamically import SDK
      const { EurcVaultClient } = await import("@eurc-vault/sdk" as any);
      const wallet = {
        publicKey: authority.publicKey,
        signTransaction: async (tx: any) => {
          if (tx instanceof Transaction) tx.partialSign(authority);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          txs.forEach((tx: any) => { if (tx instanceof Transaction) tx.partialSign(authority); });
          return txs;
        },
        payer: authority,
      };

      const client = new EurcVaultClient(connection, wallet, programId);
      const tx = await client.fundRewards(vaultId, { amount });

      const signature = await signAndSendTransaction(
        tx,
        authority,
        `manual:fundRewards:${vaultEntry.slug}:${amount}`,
      );

      logger.info(
        `Manual fund rewards: ${amount} base units to ${vaultEntry.name}, sig=${signature}`,
      );

      return { success: true, signature };
    } catch (err: any) {
      logger.error(`Manual fund rewards failed:`, err);
      throw new HttpsError(
        "internal",
        err.message || "Failed to fund rewards",
      );
    }
  },
);
