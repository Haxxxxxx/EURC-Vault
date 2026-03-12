import { defineString, defineSecret } from "firebase-functions/params";

// ---------------------------------------------------------------------------
// Environment configuration
//
// Uses firebase-functions/params for typed, validated config values.
// Values are resolved from .env files, Cloud Functions environment, or
// firebase functions:config at deploy / emulator start time.
// ---------------------------------------------------------------------------

const solanaRpcUrlParam = defineString("SOLANA_RPC_URL", {
  default: "https://api.devnet.solana.com",
  description: "Solana RPC endpoint URL",
});

const programIdParam = defineString("PROGRAM_ID", {
  default: "EDtprVCrspYrtBezVdwpGmbYehN1cm1PmkPD6o65gJq1",
  description: "EURC Vault program ID on Solana",
});

const eurcMintParam = defineString("EURC_MINT", {
  default: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
  description: "EURC SPL token mint address",
});

// ---------------------------------------------------------------------------
// Exported constants — call .value() at runtime (inside a function handler)
// ---------------------------------------------------------------------------

export const SOLANA_RPC_URL = solanaRpcUrlParam;
export const PROGRAM_ID = programIdParam;
export const EURC_MINT = eurcMintParam;

/** Vault authority keypair for epoch automation (base58-encoded secret key) */
export const VAULT_AUTHORITY_KEYPAIR = defineSecret("VAULT_AUTHORITY_KEYPAIR");

/** Faucet mint authority keypair (base58-encoded secret key) */
export const FAUCET_MINT_AUTHORITY_SECRET = defineSecret("FAUCET_MINT_AUTHORITY");

/** Default region for all Cloud Functions */
export const REGION = "us-central1";
