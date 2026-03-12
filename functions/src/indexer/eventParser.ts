import { createHash } from "crypto";
import bs58 from "bs58";

// ---------------------------------------------------------------------------
// Anchor event parser for EURC Vault program
//
// Parses base64-encoded Anchor event data from Solana transaction logs.
// Anchor emits events as "Program data: <base64>" log lines where the first
// 8 bytes are the event discriminator (SHA-256 of "event:{EventName}" truncated
// to 8 bytes), followed by Borsh-encoded fields in declaration order.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Parsed event interfaces
// ---------------------------------------------------------------------------

export interface ParsedDeposited {
  name: "Deposited";
  vault: string;
  user: string;
  amount: bigint;
  totalDeposited: bigint;
  rewardsClaimed: bigint;
}

export interface ParsedWithdrawalInitiated {
  name: "WithdrawalInitiated";
  vault: string;
  user: string;
  amount: bigint;
  availableAt: bigint;
}

export interface ParsedWithdrawalCompleted {
  name: "WithdrawalCompleted";
  vault: string;
  user: string;
  amount: bigint;
  rewardsClaimed: bigint;
}

export interface ParsedWithdrawalCancelled {
  name: "WithdrawalCancelled";
  vault: string;
  user: string;
  amount: bigint;
}

export interface ParsedRewardsClaimed {
  name: "RewardsClaimed";
  vault: string;
  user: string;
  amount: bigint;
}

export interface ParsedEpochAdvanced {
  name: "EpochAdvanced";
  vault: string;
  epochNumber: bigint;
  totalDepositsSnapshot: bigint;
  totalRewardsDistributed: bigint;
}

export interface ParsedRewardsFunded {
  name: "RewardsFunded";
  vault: string;
  funder: string;
  amount: bigint;
  newAccRewardPerShare: bigint;
}

export interface ParsedVaultPauseToggled {
  name: "VaultPauseToggled";
  vault: string;
  paused: boolean;
}

export interface ParsedAuthorityTransferInitiated {
  name: "AuthorityTransferInitiated";
  vault: string;
  currentAuthority: string;
  newAuthority: string;
}

export interface ParsedAuthorityTransferred {
  name: "AuthorityTransferred";
  vault: string;
  oldAuthority: string;
  newAuthority: string;
}

export interface ParsedEmergencyWithdrawalExecuted {
  name: "EmergencyWithdrawalExecuted";
  vault: string;
  user: string;
  depositAmount: bigint;
  rewardsClaimed: bigint;
}

export type ParsedEvent =
  | ParsedDeposited
  | ParsedWithdrawalInitiated
  | ParsedWithdrawalCompleted
  | ParsedWithdrawalCancelled
  | ParsedRewardsClaimed
  | ParsedEpochAdvanced
  | ParsedRewardsFunded
  | ParsedVaultPauseToggled
  | ParsedAuthorityTransferInitiated
  | ParsedAuthorityTransferred
  | ParsedEmergencyWithdrawalExecuted;

// ---------------------------------------------------------------------------
// Discriminator computation
//
// Anchor event discriminator = first 8 bytes of SHA-256("event:<EventName>")
// ---------------------------------------------------------------------------

function eventDiscriminator(name: string): Buffer {
  return createHash("sha256")
    .update(`event:${name}`)
    .digest()
    .subarray(0, 8);
}

// Pre-compute discriminators at module load time for fast matching
const DISCRIMINATORS = {
  Deposited: eventDiscriminator("Deposited"),
  WithdrawalInitiated: eventDiscriminator("WithdrawalInitiated"),
  WithdrawalCompleted: eventDiscriminator("WithdrawalCompleted"),
  WithdrawalCancelled: eventDiscriminator("WithdrawalCancelled"),
  RewardsClaimed: eventDiscriminator("RewardsClaimed"),
  EpochAdvanced: eventDiscriminator("EpochAdvanced"),
  RewardsFunded: eventDiscriminator("RewardsFunded"),
  VaultPauseToggled: eventDiscriminator("VaultPauseToggled"),
  AuthorityTransferInitiated: eventDiscriminator("AuthorityTransferInitiated"),
  AuthorityTransferred: eventDiscriminator("AuthorityTransferred"),
  EmergencyWithdrawalExecuted: eventDiscriminator("EmergencyWithdrawalExecuted"),
} as const;

// Build a hex-keyed lookup for O(1) matching
const DISC_HEX_MAP = new Map<string, keyof typeof DISCRIMINATORS>();
for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
  DISC_HEX_MAP.set(disc.toString("hex"), name as keyof typeof DISCRIMINATORS);
}

// ---------------------------------------------------------------------------
// Buffer reader helpers (little-endian Borsh deserialization)
// ---------------------------------------------------------------------------

class BorshReader {
  private offset = 0;

  constructor(private readonly buf: Buffer) {}

  get remaining(): number {
    return this.buf.length - this.offset;
  }

  readPubkey(): string {
    if (this.remaining < 32) {
      throw new Error(
        `Not enough bytes for pubkey: need 32, have ${this.remaining}`,
      );
    }
    const bytes = this.buf.subarray(this.offset, this.offset + 32);
    this.offset += 32;
    return bs58.encode(bytes);
  }

  readU64(): bigint {
    if (this.remaining < 8) {
      throw new Error(
        `Not enough bytes for u64: need 8, have ${this.remaining}`,
      );
    }
    const value = this.buf.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readI64(): bigint {
    if (this.remaining < 8) {
      throw new Error(
        `Not enough bytes for i64: need 8, have ${this.remaining}`,
      );
    }
    const value = this.buf.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readU128(): bigint {
    if (this.remaining < 16) {
      throw new Error(
        `Not enough bytes for u128: need 16, have ${this.remaining}`,
      );
    }
    // u128 LE: low 8 bytes first, then high 8 bytes
    const lo = this.buf.readBigUInt64LE(this.offset);
    const hi = this.buf.readBigUInt64LE(this.offset + 8);
    this.offset += 16;
    return (hi << 64n) | lo;
  }

  readBool(): boolean {
    if (this.remaining < 1) {
      throw new Error(
        `Not enough bytes for bool: need 1, have ${this.remaining}`,
      );
    }
    const value = this.buf[this.offset] !== 0;
    this.offset += 1;
    return value;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }
}

// ---------------------------------------------------------------------------
// Event decoders
// ---------------------------------------------------------------------------

function decodeDeposited(reader: BorshReader): ParsedDeposited {
  return {
    name: "Deposited",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    amount: reader.readU64(),
    totalDeposited: reader.readU64(),
    rewardsClaimed: reader.readU64(),
  };
}

function decodeWithdrawalInitiated(
  reader: BorshReader,
): ParsedWithdrawalInitiated {
  return {
    name: "WithdrawalInitiated",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    amount: reader.readU64(),
    availableAt: reader.readI64(),
  };
}

function decodeWithdrawalCompleted(
  reader: BorshReader,
): ParsedWithdrawalCompleted {
  return {
    name: "WithdrawalCompleted",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    amount: reader.readU64(),
    rewardsClaimed: reader.readU64(),
  };
}

function decodeWithdrawalCancelled(
  reader: BorshReader,
): ParsedWithdrawalCancelled {
  return {
    name: "WithdrawalCancelled",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    amount: reader.readU64(),
  };
}

function decodeRewardsClaimed(reader: BorshReader): ParsedRewardsClaimed {
  return {
    name: "RewardsClaimed",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    amount: reader.readU64(),
  };
}

function decodeEpochAdvanced(reader: BorshReader): ParsedEpochAdvanced {
  return {
    name: "EpochAdvanced",
    vault: reader.readPubkey(),
    epochNumber: reader.readU64(),
    totalDepositsSnapshot: reader.readU64(),
    totalRewardsDistributed: reader.readU64(),
  };
}

function decodeRewardsFunded(reader: BorshReader): ParsedRewardsFunded {
  return {
    name: "RewardsFunded",
    vault: reader.readPubkey(),
    funder: reader.readPubkey(),
    amount: reader.readU64(),
    newAccRewardPerShare: reader.readU128(),
  };
}

function decodeVaultPauseToggled(reader: BorshReader): ParsedVaultPauseToggled {
  return {
    name: "VaultPauseToggled",
    vault: reader.readPubkey(),
    paused: reader.readBool(),
  };
}

function decodeAuthorityTransferInitiated(
  reader: BorshReader,
): ParsedAuthorityTransferInitiated {
  return {
    name: "AuthorityTransferInitiated",
    vault: reader.readPubkey(),
    currentAuthority: reader.readPubkey(),
    newAuthority: reader.readPubkey(),
  };
}

function decodeAuthorityTransferred(
  reader: BorshReader,
): ParsedAuthorityTransferred {
  return {
    name: "AuthorityTransferred",
    vault: reader.readPubkey(),
    oldAuthority: reader.readPubkey(),
    newAuthority: reader.readPubkey(),
  };
}

function decodeEmergencyWithdrawalExecuted(
  reader: BorshReader,
): ParsedEmergencyWithdrawalExecuted {
  return {
    name: "EmergencyWithdrawalExecuted",
    vault: reader.readPubkey(),
    user: reader.readPubkey(),
    depositAmount: reader.readU64(),
    rewardsClaimed: reader.readU64(),
  };
}

type EventDecoder = (reader: BorshReader) => ParsedEvent;

const DECODERS: Record<keyof typeof DISCRIMINATORS, EventDecoder> = {
  Deposited: decodeDeposited,
  WithdrawalInitiated: decodeWithdrawalInitiated,
  WithdrawalCompleted: decodeWithdrawalCompleted,
  WithdrawalCancelled: decodeWithdrawalCancelled,
  RewardsClaimed: decodeRewardsClaimed,
  EpochAdvanced: decodeEpochAdvanced,
  RewardsFunded: decodeRewardsFunded,
  VaultPauseToggled: decodeVaultPauseToggled,
  AuthorityTransferInitiated: decodeAuthorityTransferInitiated,
  AuthorityTransferred: decodeAuthorityTransferred,
  EmergencyWithdrawalExecuted: decodeEmergencyWithdrawalExecuted,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Anchor events from Solana transaction log messages.
 *
 * Scans for "Program data:" lines, base64-decodes them, matches the 8-byte
 * discriminator, and Borsh-deserializes the event fields.
 *
 * Returns an array of parsed events (may be empty if no known events found).
 */
export function parseEventsFromLogs(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const line of logs) {
    // Anchor emits events as "Program data: <base64>"
    if (!line.startsWith("Program data: ")) continue;

    const base64Data = line.slice("Program data: ".length).trim();
    if (!base64Data) continue;

    let data: Buffer;
    try {
      data = Buffer.from(base64Data, "base64");
    } catch {
      console.warn("Failed to base64-decode program data line");
      continue;
    }

    // Need at least 8 bytes for the discriminator
    if (data.length < 8) continue;

    const discHex = data.subarray(0, 8).toString("hex");
    const eventName = DISC_HEX_MAP.get(discHex);
    if (!eventName) continue; // Unknown event -- skip silently

    const decoder = DECODERS[eventName];
    const reader = new BorshReader(data);
    reader.skip(8); // Skip discriminator

    try {
      const event = decoder(reader);
      events.push(event);
    } catch (err) {
      console.warn(
        `Failed to decode ${eventName} event (data length: ${data.length}):`,
        err,
      );
    }
  }

  return events;
}
