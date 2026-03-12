import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

export function useTokenBalance(mint: PublicKey) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(0);
      setLoading(false);
      return;
    }

    let subId: number | undefined;

    const fetchBalance = async () => {
      try {
        const ata = getAssociatedTokenAddressSync(mint, publicKey);
        const info = await connection.getTokenAccountBalance(ata);
        setBalance(Number(info.value.amount));
      } catch {
        // ATA doesn't exist — balance is 0
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    const subscribe = async () => {
      try {
        const ata = getAssociatedTokenAddressSync(mint, publicKey);
        subId = connection.onAccountChange(ata, (accountInfo) => {
          try {
            // SPL token account data: amount is at offset 64, 8 bytes LE
            const data = accountInfo.data;
            if (data.length >= 72) {
              const amount = data.readBigUInt64LE(64);
              setBalance(Number(amount));
            }
          } catch {
            // ignore decode errors
          }
        });
      } catch {
        // ATA doesn't exist yet, subscription will fail — that's ok
      }
    };

    fetchBalance();
    subscribe();

    return () => {
      if (subId !== undefined) {
        connection.removeAccountChangeListener(subId);
      }
    };
  }, [connection, publicKey, connected, mint]);

  return { balance, loading };
}
