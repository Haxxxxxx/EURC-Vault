import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { getVaultBySlug } from '@/lib/constants';
import { parseTransactionError } from '@/lib/errors';
import { buildDepositTx } from '@/lib/devnet-tx';

export function useDeposit(slug: string) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const deposit = useCallback(
    async (amountBaseUnits: number): Promise<string | null> => {
      const entry = getVaultBySlug(slug);
      if (!entry || !publicKey) return null;

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Submitting deposit...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = client
          ? await client.deposit(entry.onChainId, { amount: amountBaseUnits })
          : buildDepositTx(publicKey, entry.onChainId, BigInt(amountBaseUnits));
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming deposit...',
          description: 'Waiting for on-chain confirmation',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Deposit successful',
          description: 'EURC deposited — pbEURC shares minted to your wallet',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Deposit failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, slug, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  return { deposit, loading };
}
