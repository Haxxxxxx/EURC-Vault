import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getConnection } from "../lib/solana.js";
import { db } from "../lib/firestore.js";
import { loadKeypair, signAndSendTransaction } from "../lib/transactionSigner.js";
import { SOLANA_RPC_URL, EURC_MINT, REGION } from "../config.js";

const FAUCET_MINT_AUTHORITY = defineSecret("FAUCET_MINT_AUTHORITY");

const EURC_DECIMALS = 6;
const MAX_AMOUNT_PER_24H = 10_000; // 10,000 EURC
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cloud Function: Mint test EURC to a devnet wallet.
 *
 * - Server holds mint authority keypair (via defineSecret)
 * - Creates ATA idempotently
 * - Cloud Function pays gas (SOL) — user doesn't need SOL
 * - Rate limited: 10,000 EURC per wallet per 24h
 * - Devnet-only guard
 */
export const mintTestEurc = onCall(
  {
    region: REGION,
    secrets: [FAUCET_MINT_AUTHORITY],
    maxInstances: 5,
  },
  async (request) => {
    const { wallet, amount } = request.data as {
      wallet?: string;
      amount?: number;
    };

    // Validate inputs
    if (!wallet || typeof wallet !== "string") {
      throw new HttpsError("invalid-argument", "wallet is required");
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount must be a positive number (in EURC, not base units)");
    }
    if (amount > MAX_AMOUNT_PER_24H) {
      throw new HttpsError("invalid-argument", `Max ${MAX_AMOUNT_PER_24H} EURC per request`);
    }

    // Devnet guard
    const rpcUrl = SOLANA_RPC_URL.value();
    if (!rpcUrl.includes("devnet")) {
      throw new HttpsError("failed-precondition", "Faucet is only available on devnet");
    }

    // Validate wallet address
    let recipientKey: PublicKey;
    try {
      recipientKey = new PublicKey(wallet);
    } catch {
      throw new HttpsError("invalid-argument", "Invalid Solana address");
    }

    // Rate limiting
    const faucetLimitRef = db.collection("faucet_limits").doc(wallet);
    const limitDoc = await faucetLimitRef.get();

    if (limitDoc.exists) {
      const data = limitDoc.data()!;
      const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

      if (data.lastMintTime > windowStart) {
        const totalInWindow = (data.amountInWindow || 0) + amount;
        if (totalInWindow > MAX_AMOUNT_PER_24H) {
          const remaining = MAX_AMOUNT_PER_24H - (data.amountInWindow || 0);
          throw new HttpsError(
            "resource-exhausted",
            `Rate limit exceeded. ${Math.max(remaining, 0)} EURC remaining in 24h window.`,
          );
        }
      }
    }

    // Load mint authority
    const mintAuthority = loadKeypair(FAUCET_MINT_AUTHORITY.value());
    const eurcMint = new PublicKey(EURC_MINT.value());

    // Build transaction
    const ata = getAssociatedTokenAddressSync(eurcMint, recipientKey);
    const mintAmount = BigInt(amount) * BigInt(10 ** EURC_DECIMALS);

    const tx = new Transaction().add(
      // Create ATA if it doesn't exist (idempotent)
      createAssociatedTokenAccountIdempotentInstruction(
        mintAuthority.publicKey, // payer
        ata,
        recipientKey,
        eurcMint,
      ),
      // Mint tokens
      createMintToInstruction(
        eurcMint,
        ata,
        mintAuthority.publicKey, // mint authority
        mintAmount,
      ),
    );

    // Sign and send
    const signature = await signAndSendTransaction(
      tx,
      mintAuthority,
      `faucet:mint:${amount}EURC:${wallet}`,
    );

    // Update rate limit
    const limitUpdate = limitDoc.exists
      ? {
          amountInWindow:
            (limitDoc.data()!.lastMintTime > Date.now() - RATE_LIMIT_WINDOW_MS
              ? limitDoc.data()!.amountInWindow || 0
              : 0) + amount,
          lastMintTime: Date.now(),
        }
      : {
          amountInWindow: amount,
          lastMintTime: Date.now(),
        };

    await faucetLimitRef.set(limitUpdate, { merge: true });

    return {
      success: true,
      signature,
      amount,
      wallet,
    };
  },
);
