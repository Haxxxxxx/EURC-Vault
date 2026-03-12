import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1");
const TEST_EURC_MINT = new PublicKey("3G8zXbwK4wUkCa3hS6q1NtCPgBvHWnbJu6A3iqDTxFTq");

const VAULT_SEED = Buffer.from("vault");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");
const USER_STAKE_SEED = Buffer.from("user_stake");

const DEPOSIT_AMOUNT = 500_000_000; // 500 EURC (6 decimals)

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const user = provider.wallet.publicKey;

  // Derive vault config PDA (vault_id = 1)
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(1n);
  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, idBuf],
    PROGRAM_ID,
  );

  // Derive vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );

  // Derive user stake PDA
  const [userStake] = PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, vaultConfig.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );

  // Derive vault token account (ATA of vault authority)
  const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
    [
      vaultAuthority.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      TEST_EURC_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Derive user token account (ATA of user)
  const [userTokenAccount] = PublicKey.findProgramAddressSync(
    [
      user.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      TEST_EURC_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  console.log("Vault Config:", vaultConfig.toBase58());
  console.log("User Stake PDA:", userStake.toBase58());
  console.log("User Token Account:", userTokenAccount.toBase58());
  console.log("Deposit Amount:", DEPOSIT_AMOUNT / 1_000_000, "EURC");

  // Build deposit instruction
  const disc = createHash("sha256")
    .update("global:deposit")
    .digest()
    .subarray(0, 8);

  const data = Buffer.alloc(8 + 8); // disc + amount (u64)
  disc.copy(data, 0);
  data.writeBigUInt64LE(BigInt(DEPOSIT_AMOUNT), 8);

  const tx = new anchor.web3.Transaction().add({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },           // user
      { pubkey: vaultConfig, isSigner: false, isWritable: true },    // vault_config
      { pubkey: userStake, isSigner: false, isWritable: true },      // user_stake
      { pubkey: vaultAuthority, isSigner: false, isWritable: false }, // vault_authority
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true }, // vault_token_account
      { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  console.log("\nSending deposit transaction...");
  const sig = await provider.sendAndConfirm(tx);
  console.log("\nSuccess!");
  console.log("Signature:", sig);
  console.log(`\nExplorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // Check balances after
  const conn = provider.connection;
  const userBal = await conn.getTokenAccountBalance(userTokenAccount);
  const vaultBal = await conn.getTokenAccountBalance(vaultTokenAccount);
  console.log(`\nUser EURC balance: ${userBal.value.uiAmountString}`);
  console.log(`Vault EURC balance: ${vaultBal.value.uiAmountString}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
