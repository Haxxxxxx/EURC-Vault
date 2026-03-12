import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { parseTransactionError } from '@/lib/errors';

export function useTransferAuthority() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const initiateTransfer = useCallback(
    async (vaultId: number, newAuthority: string): Promise<string | null> => {
      if (!publicKey || !client) return null;

      let newAuthorityKey: PublicKey;
      try {
        newAuthorityKey = new PublicKey(newAuthority);
      } catch {
        addToast({
          variant: 'error',
          title: 'Invalid address',
          description: 'The provided address is not a valid Solana public key',
        });
        return null;
      }

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Initiating authority transfer...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = await client.initiateAuthorityTransfer(vaultId, {
          newAuthority: newAuthorityKey,
        });
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming transaction...',
          description: 'Waiting for on-chain confirmation',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Authority transfer initiated',
          description: 'New authority must accept the transfer',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Authority transfer failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  return { initiateTransfer, loading };
}
