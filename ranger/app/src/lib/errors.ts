/**
 * User-friendly error parser for Solana / Anchor / wallet adapter errors.
 * Converts cryptic error messages into actionable descriptions.
 */

const ERROR_MAP: [RegExp, string][] = [
  [/User rejected/i,                        'Transaction cancelled — you rejected the request in your wallet.'],
  [/Blockhash not found/i,                  'Transaction expired — please try again.'],
  [/insufficient funds/i,                   'Insufficient SOL for transaction fees. You need a small amount of SOL to cover network fees.'],
  [/insufficient lamports/i,                'Insufficient SOL for transaction fees.'],
  [/0x1$/,                                  'Insufficient token balance for this transaction.'],
  [/0x0$/,                                  'Transaction failed — the program returned a generic error. Please try again.'],
  [/Transaction simulation failed/i,        'Transaction would fail on-chain. Try a smaller amount or check your balance.'],
  [/Attempt to debit/i,                     'Insufficient balance for this transaction.'],
  [/WalletNotConnectedError/i,              'Wallet disconnected — please reconnect.'],
  [/WalletSignTransactionError/i,           'Failed to sign transaction — please try again.'],
  [/WalletSendTransactionError/i,           'Failed to send transaction — check your network connection.'],
  [/Network request failed/i,               'Network error — check your connection and try again.'],
  [/timeout/i,                              'Request timed out — the network may be congested. Try again.'],
  [/429|rate.?limit/i,                      'Too many requests — please wait a moment and try again.'],
  [/AccountNotFound/i,                      'Token account not found. This may be your first interaction with this token.'],
  [/custom program error: 0x/i,             'The vault program returned an error. Please try again or reduce your amount.'],
];

export function parseUserError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(message)) return friendly;
  }

  // Truncate overly long raw messages
  if (message.length > 120) {
    return 'Transaction failed — please try again. If the issue persists, try a smaller amount.';
  }

  return message || 'An unexpected error occurred.';
}
