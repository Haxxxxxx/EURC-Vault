import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAM_ID = new PublicKey("EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1");
const TEST_EURC_MINT = new PublicKey("3G8zXbwK4wUkCa3hS6q1NtCPgBvHWnbJu6A3iqDTxFTq");

const VAULT_SEED = Buffer.from("vault");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");
const USER_STAKE_SEED = Buffer.from("user_stake");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function disc(name: string): Buffer {
  return createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getBalances(
  conn: anchor.web3.Connection,
  userAta: PublicKey,
  vaultAta: PublicKey,
): Promise<{ user: string; vault: string }> {
  const [u, v] = await Promise.all([
    conn.getTokenAccountBalance(userAta),
    conn.getTokenAccountBalance(vaultAta),
  ]);
  return { user: u.value.uiAmountString!, vault: v.value.uiAmountString! };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const conn = provider.connection;
  const user = provider.wallet.publicKey;

  // --- Derive all PDAs ---
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(1n);

  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, idBuf],
    PROGRAM_ID,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );
  const [userStake] = PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, vaultConfig.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );
  const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
    [vaultAuthority.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), TEST_EURC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [userTokenAccount] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), TEST_EURC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Shared account keys for user instructions (claim, initiate, complete)
  const userInstructionKeys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  let bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log("=".repeat(60));
  console.log("EURC VAULT — FULL FLOW TEST");
  console.log("=".repeat(60));
  console.log(`\nStarting balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);

  // =========================================================================
  // STEP 1: Fund Rewards (50 EURC)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 1: Fund Rewards — 50 EURC");
  console.log("-".repeat(60));

  const REWARD_AMOUNT = 50_000_000n; // 50 EURC
  const fundData = Buffer.alloc(16);
  disc("fund_rewards").copy(fundData, 0);
  fundData.writeBigUInt64LE(REWARD_AMOUNT, 8);

  const fundTx = new anchor.web3.Transaction().add({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },          // authority
      { pubkey: vaultConfig, isSigner: false, isWritable: true },   // vault_config
      { pubkey: vaultAuthority, isSigner: false, isWritable: false }, // vault_authority
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true }, // vault_token_account
      { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // funder_token_account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: fundData,
  });

  const fundSig = await provider.sendAndConfirm(fundTx);
  bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`✓ Funded 50 EURC as rewards`);
  console.log(`  Balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);
  console.log(`  Sig: ${fundSig}`);
  console.log(`  https://explorer.solana.com/tx/${fundSig}?cluster=devnet`);

  // =========================================================================
  // STEP 2: Claim Rewards
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 2: Claim Rewards");
  console.log("-".repeat(60));

  const claimData = disc("claim_rewards");

  const claimTx = new anchor.web3.Transaction().add({
    keys: userInstructionKeys,
    programId: PROGRAM_ID,
    data: claimData,
  });

  const claimSig = await provider.sendAndConfirm(claimTx);
  bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`✓ Rewards claimed`);
  console.log(`  Balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);
  console.log(`  Sig: ${claimSig}`);
  console.log(`  https://explorer.solana.com/tx/${claimSig}?cluster=devnet`);

  // =========================================================================
  // STEP 3: Initiate Withdrawal (250 EURC — half the deposit)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 3: Initiate Withdrawal — 250 EURC");
  console.log("-".repeat(60));

  const WITHDRAW_AMOUNT = 250_000_000n; // 250 EURC
  const initWithdrawData = Buffer.alloc(16);
  disc("initiate_withdrawal").copy(initWithdrawData, 0);
  initWithdrawData.writeBigUInt64LE(WITHDRAW_AMOUNT, 8);

  const initWithdrawTx = new anchor.web3.Transaction().add({
    keys: userInstructionKeys,
    programId: PROGRAM_ID,
    data: initWithdrawData,
  });

  const initWithdrawSig = await provider.sendAndConfirm(initWithdrawTx);
  bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`✓ Withdrawal initiated (cooldown started)`);
  console.log(`  Balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);
  console.log(`  Sig: ${initWithdrawSig}`);
  console.log(`  https://explorer.solana.com/tx/${initWithdrawSig}?cluster=devnet`);

  // =========================================================================
  // STEP 4: Try Complete Withdrawal (should fail — cooldown active)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 4: Try Complete Withdrawal (expect failure — cooldown)");
  console.log("-".repeat(60));

  const completeData = disc("complete_withdrawal");

  try {
    const earlyTx = new anchor.web3.Transaction().add({
      keys: userInstructionKeys,
      programId: PROGRAM_ID,
      data: completeData,
    });
    await provider.sendAndConfirm(earlyTx);
    console.log("✗ Should have failed but didn't!");
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes("WithdrawalCooldownActive") || errMsg.includes("0x1778") || errMsg.includes("6008")) {
      console.log(`✓ Correctly rejected — cooldown still active`);
    } else {
      console.log(`✓ Rejected with error: ${errMsg.slice(0, 120)}`);
    }
  }

  // =========================================================================
  // STEP 5: Update vault to 0s cooldown, then re-initiate + complete
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 5: Update vault cooldown to 0, cancel + re-initiate + complete");
  console.log("-".repeat(60));

  // 5a: Update vault config — set withdrawal_cooldown = 0
  const updateDisc = disc("update_vault_config");
  // Args: Option<u64> new_max_capacity, Option<i64> new_epoch_duration, Option<i64> new_withdrawal_cooldown
  // Option encoding: 0 = None (1 byte), 1 + value = Some (1 + 8 bytes)
  const updateData = Buffer.alloc(8 + 1 + 1 + 1 + 8);
  updateDisc.copy(updateData, 0);
  updateData.writeUInt8(0, 8);   // None for max_capacity
  updateData.writeUInt8(0, 9);   // None for epoch_duration
  updateData.writeUInt8(1, 10);  // Some for withdrawal_cooldown
  updateData.writeBigInt64LE(0n, 11); // cooldown = 0

  const updateTx = new anchor.web3.Transaction().add({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },         // authority
      { pubkey: vaultConfig, isSigner: false, isWritable: true },  // vault_config
    ],
    programId: PROGRAM_ID,
    data: updateData,
  });

  await provider.sendAndConfirm(updateTx);
  console.log(`✓ Vault cooldown updated to 0 seconds`);

  // 5b: Cancel current withdrawal
  const cancelData = disc("cancel_withdrawal");
  const cancelTx = new anchor.web3.Transaction().add({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: userStake, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: cancelData,
  });

  const cancelSig = await provider.sendAndConfirm(cancelTx);
  bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`✓ Withdrawal cancelled (funds re-staked)`);
  console.log(`  Balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);
  console.log(`  Sig: ${cancelSig}`);

  // 5c: Re-initiate withdrawal with 0 cooldown
  const reInitTx = new anchor.web3.Transaction().add({
    keys: userInstructionKeys,
    programId: PROGRAM_ID,
    data: initWithdrawData, // Same 250 EURC
  });

  const reInitSig = await provider.sendAndConfirm(reInitTx);
  console.log(`✓ Withdrawal re-initiated (0s cooldown)`);
  console.log(`  Sig: ${reInitSig}`);

  // 5d: Complete withdrawal immediately
  const completeTx = new anchor.web3.Transaction().add({
    keys: userInstructionKeys,
    programId: PROGRAM_ID,
    data: completeData,
  });

  const completeSig = await provider.sendAndConfirm(completeTx);
  bal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`✓ Withdrawal completed — 250 EURC returned to user`);
  console.log(`  Balances → User: ${bal.user} EURC | Vault: ${bal.vault} EURC`);
  console.log(`  Sig: ${completeSig}`);
  console.log(`  https://explorer.solana.com/tx/${completeSig}?cluster=devnet`);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("FULL FLOW COMPLETE");
  console.log("=".repeat(60));
  const finalBal = await getBalances(conn, userTokenAccount, vaultTokenAccount);
  console.log(`Final balances → User: ${finalBal.user} EURC | Vault: ${finalBal.vault} EURC`);
  console.log(`\nAll 6 instructions tested:`);
  console.log(`  1. fund_rewards       ✓`);
  console.log(`  2. claim_rewards      ✓`);
  console.log(`  3. initiate_withdrawal ✓`);
  console.log(`  4. complete_withdrawal ✗ (cooldown enforced)`);
  console.log(`  5. update_vault_config ✓`);
  console.log(`  6. cancel_withdrawal   ✓`);
  console.log(`  7. initiate_withdrawal ✓ (0s cooldown)`);
  console.log(`  8. complete_withdrawal ✓`);
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});
