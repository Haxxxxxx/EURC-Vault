'use client';

import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Keypair } from '@solana/web3.js';
import { PROGRAM_ID } from '@/lib/constants';

// Lazy-import the SDK to avoid SSR issues with Anchor's IDL parser
type EurcVaultClient = import('@eurc-vault/sdk').EurcVaultClient;

interface VaultClientContextValue {
  client: EurcVaultClient | null;
  ready: boolean;
}

const VaultClientContext = createContext<VaultClientContextValue>({
  client: null,
  ready: false,
});

// Dummy wallet for read-only queries (never signs).
// Lazily initialized to avoid Keypair.generate() during SSR/static builds.
let _dummyWallet: any = null;
function getDummyWallet() {
  if (!_dummyWallet) {
    const kp = Keypair.generate();
    _dummyWallet = {
      publicKey: kp.publicKey,
      signTransaction: () => Promise.reject(new Error('Read-only client cannot sign')),
      signAllTransactions: () => Promise.reject(new Error('Read-only client cannot sign')),
    };
  }
  return _dummyWallet;
}

let sdkWarned = false;

function createClient(
  connection: import('@solana/web3.js').Connection,
  wallet: any,
): EurcVaultClient | null {
  try {
    const { EurcVaultClient: Client } = require('@eurc-vault/sdk'); // dynamic require to avoid SSR IDL parse
    return new Client(connection, wallet, PROGRAM_ID);
  } catch {
    // IDL parsing may fail (e.g. event types missing) — fall back to null
    if (!sdkWarned) {
      console.warn('[VaultClientProvider] SDK unavailable — using mock data fallback');
      sdkWarned = true;
    }
    return null;
  }
}

export function VaultClientProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const value = useMemo<VaultClientContextValue>(() => {
    if (!anchorWallet) return { client: null, ready: false };
    const client = createClient(connection, anchorWallet);
    return { client, ready: client !== null };
  }, [connection, anchorWallet]);

  return (
    <VaultClientContext.Provider value={value}>
      {children}
    </VaultClientContext.Provider>
  );
}

/** Returns { client, ready } — client is null when wallet is not connected. */
export function useVaultClient() {
  return useContext(VaultClientContext);
}

/** Returns a read-only client for queries without a connected wallet. */
export function useReadOnlyClient(): EurcVaultClient | null {
  const { connection } = useConnection();
  const [client, setClient] = useState<EurcVaultClient | null>(null);

  useEffect(() => {
    // Guard: only create client in the browser
    if (typeof window === 'undefined') return;
    const c = createClient(connection, getDummyWallet());
    setClient(c);
  }, [connection]);

  return client;
}
