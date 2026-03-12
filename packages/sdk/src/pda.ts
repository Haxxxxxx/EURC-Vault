import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  VAULT_SEED,
  USER_STAKE_SEED,
  EPOCH_SEED,
  VAULT_AUTHORITY_SEED,
  PROGRAM_ID,
} from "./constants";
import type { PdaResult } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a number or BN to a little-endian 8-byte Buffer (u64). */
function toLeBytesU64(value: number | BN): Buffer {
  const bn = BN.isBN(value) ? value : new BN(value);
  return bn.toArrayLike(Buffer, "le", 8);
}

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

/**
 * Derive the VaultConfig PDA.
 *
 * Seeds: `["vault", vault_id.to_le_bytes()]`
 */
export function findVaultConfigPda(
  vaultId: number | BN,
  programId: PublicKey = PROGRAM_ID,
): PdaResult {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, toLeBytesU64(vaultId)],
    programId,
  );
  return { publicKey, bump };
}

/**
 * Derive the UserStake PDA.
 *
 * Seeds: `["user_stake", vault_config.key(), user.key()]`
 */
export function findUserStakePda(
  vault: PublicKey,
  user: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): PdaResult {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, vault.toBuffer(), user.toBuffer()],
    programId,
  );
  return { publicKey, bump };
}

/**
 * Derive the EpochSnapshot PDA.
 *
 * Seeds: `["epoch", vault_config.key(), epoch_number.to_le_bytes()]`
 */
export function findEpochSnapshotPda(
  vault: PublicKey,
  epochNumber: number | BN,
  programId: PublicKey = PROGRAM_ID,
): PdaResult {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(
    [EPOCH_SEED, vault.toBuffer(), toLeBytesU64(epochNumber)],
    programId,
  );
  return { publicKey, bump };
}

/**
 * Derive the VaultAuthority PDA (owns the vault token account).
 *
 * Seeds: `["vault_authority", vault_config.key()]`
 */
export function findVaultAuthorityPda(
  vault: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): PdaResult {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, vault.toBuffer()],
    programId,
  );
  return { publicKey, bump };
}
