import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { getVaultBySlug } from '@/lib/constants';
import { parseTransactionError } from '@/lib/errors';
import { buildEmergencyWithdrawTx } from '@/lib/devnet-tx';

export function useEmergencyWithdraw(slug: string) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const emergencyWithdraw = useCallback(async (): Promise<string | null> => {
    const entry = getVaultBySlug(slug);
    if (!entry || !publicKey) return null;

    setLoading(true);
    const toastId = addToast({
      variant: 'pending',
      title: 'Emergency withdraw...',
      description: 'Waiting for wallet approval',
    });

    try {
      const tx = client
        ? await client.emergencyWithdraw(entry.onChainId)
        : buildEmergencyWithdrawTx(publicKey, entry.onChainId);
      const signature = await sendTransaction(tx, connection);

      updateToast(toastId, {
        title: 'Confirming emergency withdrawal...',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      updateToast(toastId, {
        variant: 'success',
        title: 'Emergency withdrawal complete',
        description: 'All funds have been returned to your wallet',
        txSignature: signature,
      });

      setLoading(false);
      return signature;
    } catch (err) {
      updateToast(toastId, {
        variant: 'error',
        title: 'Emergency withdrawal failed',
        description: parseTransactionError(err),
      });
      setLoading(false);
      return null;
    }
  }, [client, slug, publicKey, connection, sendTransaction, addToast, updateToast]);

  return { emergencyWithdraw, loading };
}
