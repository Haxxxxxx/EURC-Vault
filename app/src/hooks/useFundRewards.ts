import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { parseTransactionError } from '@/lib/errors';

export function useFundRewards() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const fundRewards = useCallback(
    async (vaultId: number, amountBaseUnits: number): Promise<string | null> => {
      if (!publicKey || !client) return null;

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Funding rewards...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = await client.fundRewards(vaultId, { amount: amountBaseUnits });
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming transaction...',
          description: 'Waiting for on-chain confirmation',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Rewards funded',
          description: 'Reward pool has been updated',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Fund rewards failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  return { fundRewards, loading };
}
