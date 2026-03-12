import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1");
const TEST_EURC_MINT = new PublicKey("3G8zXbwK4wUkCa3hS6q1NtCPgBvHWnbJu6A3iqDTxFTq");

const VAULT_SEED = Buffer.from("vault");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");

async function main() {
  // Setup provider from Anchor.toml + local wallet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Derive vault config PDA
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(1));
  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, idBuf],
    PROGRAM_ID,
  );
  console.log("Vault Config PDA:", vaultConfig.toBase58());

  // Derive vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID,
  );
  console.log("Vault Authority PDA:", vaultAuthority.toBase58());

  // Derive vault token account (ATA of vault authority for EURC mint)
  const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
    [
      vaultAuthority.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      TEST_EURC_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  console.log("Vault Token Account:", vaultTokenAccount.toBase58());

  // Build the instruction manually (no IDL needed)
  // Anchor discriminator for "initialize_vault" = SHA256("global:initialize_vault")[0..8]
  const crypto = await import("crypto");
  const disc = crypto
    .createHash("sha256")
    .update("global:initialize_vault")
    .digest()
    .subarray(0, 8);

  // Encode args: vault_id (u64 LE), max_capacity (u64 LE), epoch_duration (i64 LE), withdrawal_cooldown (i64 LE)
  const data = Buffer.alloc(8 + 8 + 8 + 8 + 8); // disc + 4 args
  disc.copy(data, 0);
  data.writeBigUInt64LE(BigInt(1), 8); // vault_id
  data.writeBigUInt64LE(BigInt(10_000_000_000_000), 16); // max_capacity
  data.writeBigInt64LE(BigInt(604_800), 24); // epoch_duration
  data.writeBigInt64LE(BigInt(86_400), 32); // withdrawal_cooldown

  const tx = new anchor.web3.Transaction().add({
    keys: [
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true }, // authority
      { pubkey: vaultConfig, isSigner: false, isWritable: true }, // vault_config
      { pubkey: vaultAuthority, isSigner: false, isWritable: false }, // vault_authority
      { pubkey: TEST_EURC_MINT, isSigner: false, isWritable: false }, // eurc_mint
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true }, // vault_token_account
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  console.log("\nSending initialize_vault transaction...");
  const sig = await provider.sendAndConfirm(tx);
  console.log("\nSuccess!");
  console.log("Signature:", sig);
  console.log(`\nExplorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
