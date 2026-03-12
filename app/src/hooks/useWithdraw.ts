import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { getVaultBySlug } from '@/lib/constants';
import { parseTransactionError } from '@/lib/errors';
import {
  buildInitiateWithdrawalTx,
  buildCompleteWithdrawalTx,
  buildCancelWithdrawalTx,
} from '@/lib/devnet-tx';

export function useWithdraw(slug: string) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const initiateWithdrawal = useCallback(
    async (amountBaseUnits: number): Promise<string | null> => {
      const entry = getVaultBySlug(slug);
      if (!entry || !publicKey) return null;

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Starting withdrawal cooldown...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = client
          ? await client.initiateWithdrawal(entry.onChainId, { amount: amountBaseUnits })
          : buildInitiateWithdrawalTx(publicKey, entry.onChainId, BigInt(amountBaseUnits));
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming withdrawal initiation...',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Cooldown started',
          description: 'pbEURC shares burned — EURC locked until cooldown ends',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Withdrawal initiation failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, slug, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  const completeWithdrawal = useCallback(async (): Promise<string | null> => {
    const entry = getVaultBySlug(slug);
    if (!entry || !publicKey) return null;

    setLoading(true);
    const toastId = addToast({
      variant: 'pending',
      title: 'Processing withdrawal...',
      description: 'Waiting for wallet approval',
    });

    try {
      const tx = client
        ? await client.completeWithdrawal(entry.onChainId)
        : buildCompleteWithdrawalTx(publicKey, entry.onChainId);
      const signature = await sendTransaction(tx, connection);

      updateToast(toastId, {
        title: 'Confirming withdrawal...',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      updateToast(toastId, {
        variant: 'success',
        title: 'Withdrawal complete',
        description: 'Your EURC has been returned to your wallet',
        txSignature: signature,
      });

      setLoading(false);
      return signature;
    } catch (err) {
      updateToast(toastId, {
        variant: 'error',
        title: 'Withdrawal failed',
        description: parseTransactionError(err),
      });
      setLoading(false);
      return null;
    }
  }, [client, slug, publicKey, connection, sendTransaction, addToast, updateToast]);

  const cancelWithdrawal = useCallback(async (): Promise<string | null> => {
    const entry = getVaultBySlug(slug);
    if (!entry || !publicKey) return null;

    setLoading(true);
    const toastId = addToast({
      variant: 'pending',
      title: 'Cancelling withdrawal...',
      description: 'Waiting for wallet approval',
    });

    try {
      const tx = client
        ? await client.cancelWithdrawal(entry.onChainId)
        : buildCancelWithdrawalTx(publicKey, entry.onChainId);
      const signature = await sendTransaction(tx, connection);

      updateToast(toastId, {
        title: 'Confirming cancellation...',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      updateToast(toastId, {
        variant: 'success',
        title: 'Withdrawal cancelled',
        description: 'pbEURC shares re-minted at current exchange rate',
        txSignature: signature,
      });

      setLoading(false);
      return signature;
    } catch (err) {
      updateToast(toastId, {
        variant: 'error',
        title: 'Cancellation failed',
        description: parseTransactionError(err),
      });
      setLoading(false);
      return null;
    }
  }, [client, slug, publicKey, connection, sendTransaction, addToast, updateToast]);

  return { initiateWithdrawal, completeWithdrawal, cancelWithdrawal, loading };
}
