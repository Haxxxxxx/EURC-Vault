import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '@/providers/VaultClientProvider';
import { useToast } from '@/providers/ToastProvider';
import { parseTransactionError } from '@/lib/errors';

interface UpdateConfigParams {
  newMaxCapacity?: number;
  newEpochDuration?: number;
  newWithdrawalCooldown?: number;
}

export function useUpdateVaultConfig() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { client } = useVaultClient();
  const { addToast, updateToast } = useToast();
  const [loading, setLoading] = useState(false);

  const updateConfig = useCallback(
    async (vaultId: number, params: UpdateConfigParams): Promise<string | null> => {
      if (!publicKey || !client) return null;

      setLoading(true);
      const toastId = addToast({
        variant: 'pending',
        title: 'Updating vault config...',
        description: 'Waiting for wallet approval',
      });

      try {
        const tx = await client.updateVaultConfig(vaultId, params);
        const signature = await sendTransaction(tx, connection);

        updateToast(toastId, {
          title: 'Confirming transaction...',
          description: 'Waiting for on-chain confirmation',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        updateToast(toastId, {
          variant: 'success',
          title: 'Config updated',
          description: 'Vault configuration has been updated',
          txSignature: signature,
        });

        setLoading(false);
        return signature;
      } catch (err) {
        updateToast(toastId, {
          variant: 'error',
          title: 'Config update failed',
          description: parseTransactionError(err),
        });
        setLoading(false);
        return null;
      }
    },
    [client, publicKey, connection, sendTransaction, addToast, updateToast],
  );

  return { updateConfig, loading };
}
