/**
 * Create a test EURC-like SPL token mint on devnet.
 *
 * Uses the local wallet (~/.config/solana/id.json) as the mint authority,
 * so the DevnetFaucet can mint tokens directly from the browser.
 *
 * Usage:
 *   npx ts-node scripts/create-test-mint.ts
 *
 * After running, update TEST_EURC_MINT in:
 *   - app/src/lib/constants.ts
 *   - scripts/init-vault.ts (if you re-init vaults)
 */

import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import {
  createMint,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const DECIMALS = 6; // Same as real EURC

async function main() {
  // Load local wallet
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME || "~", ".config", "solana", "id.json");

  if (!fs.existsSync(walletPath)) {
    console.error(`Wallet not found at ${walletPath}`);
    console.error("Run: solana-keygen new   (or set ANCHOR_WALLET env var)");
    process.exit(1);
  }

  const walletKey = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))),
  );
  console.log("Wallet:", walletKey.publicKey.toBase58());

  // Connect to devnet
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");

  const balance = await connection.getBalance(walletKey.publicKey);
  if (balance < 0.05 * 1e9) {
    console.log("Low SOL balance — requesting airdrop...");
    const sig = await connection.requestAirdrop(walletKey.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Airdrop confirmed.");
  }

  // Create mint (wallet is both mint authority and freeze authority)
  console.log("\nCreating SPL token mint with 6 decimals...");
  const mint = await createMint(
    connection,
    walletKey,            // payer
    walletKey.publicKey,  // mint authority
    walletKey.publicKey,  // freeze authority (can be null)
    DECIMALS,
  );

  // Verify
  const mintInfo = await getMint(connection, mint);
  console.log("\n--- Test EURC Mint Created ---");
  console.log("Mint address:", mint.toBase58());
  console.log("Decimals:", mintInfo.decimals);
  console.log("Mint authority:", mintInfo.mintAuthority?.toBase58());
  console.log("Supply:", mintInfo.supply.toString());

  console.log("\n--- Next Steps ---");
  console.log(`1. Update TEST_EURC_MINT in app/src/lib/constants.ts:`);
  console.log(`   export const TEST_EURC_MINT = new PublicKey('${mint.toBase58()}');`);
  console.log(`2. Update TEST_EURC_MINT in scripts/init-vault.ts`);
  console.log(`3. Run: npx ts-node scripts/init-vault.ts`);
  console.log(`4. The DevnetFaucet will now work because your wallet is the mint authority.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
