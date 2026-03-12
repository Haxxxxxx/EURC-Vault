import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { parseTransactionError } from '@/lib/errors';

export function useTogglePause() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const togglePause = useCallback(
    async (vaultId: number): Promise<string | null> => {
      if (!publicKey || !client) return null;

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Toggling pause state...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = await client.togglePause(vaultId);
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming transaction...',
          description: 'Waiting for on-chain confirmation',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Pause state toggled',
          description: 'Vault pause state has been updated',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Toggle pause failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  return { togglePause, loading };
}
