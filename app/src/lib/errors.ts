import { IDL } from '@eurc-vault/sdk';

const ANCHOR_ERROR_OFFSET = 6000;

const programErrors: Record<number, { name: string; msg: string }> = {};
for (const err of (IDL as any).errors ?? []) {
  programErrors[err.code] = { name: err.name, msg: err.msg };
}

export function parseTransactionError(error: unknown): string {
  if (!error) return 'Unknown error';

  const msg = error instanceof Error ? error.message : String(error);

  // User rejected
  if (
    msg.includes('User rejected') ||
    msg.includes('Transaction was not confirmed') ||
    msg.includes('user rejected')
  ) {
    return 'Transaction cancelled by user';
  }

  // Timeout
  if (msg.includes('Transaction was not confirmed in') || msg.includes('Blockhash not found')) {
    return 'Transaction timed out. Please try again.';
  }

  // Anchor custom program error
  const anchorMatch = msg.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (anchorMatch) {
    const code = parseInt(anchorMatch[1], 16);
    const known = programErrors[code];
    if (known) return known.msg;
    return `Program error ${code}`;
  }

  // Anchor error code in decimal
  const decimalMatch = msg.match(/Error Code: (\d+)/);
  if (decimalMatch) {
    const code = parseInt(decimalMatch[1], 10);
    const known = programErrors[code];
    if (known) return known.msg;
  }

  // Anchor error name
  const nameMatch = msg.match(/Error Name: (\w+)/);
  if (nameMatch) {
    const entry = Object.values(programErrors).find((e) => e.name === nameMatch[1]);
    if (entry) return entry.msg;
  }

  // Insufficient funds
  if (msg.includes('insufficient funds') || msg.includes('Insufficient')) {
    return 'Insufficient funds for this transaction';
  }

  // Account not found
  if (msg.includes('Account does not exist')) {
    return 'Required account not found on-chain';
  }

  // Truncate long messages
  if (msg.length > 120) return msg.slice(0, 117) + '...';

  return msg;
}
