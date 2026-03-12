import { useState, useEffect } from 'react';
import { useVault } from '@/hooks/useVault';
import { getEpochTimeRemaining } from '@eurc-vault/sdk';
import { formatCountdown } from '@/lib/utils';

export function useEpochCountdown(slug?: string) {
  const { vault } = useVault(slug);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const epochStartTime = vault?.epochStartTime ?? 0;
  const epochDuration = vault?.epochDuration ?? 604_800;
  const epochNumber = vault?.currentEpoch ?? 1;

  useEffect(() => {
    if (!epochStartTime || !epochDuration) return;

    const updateCountdown = () => {
      const remaining = getEpochTimeRemaining(epochStartTime, epochDuration);
      setSecondsRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [epochStartTime, epochDuration]);

  const formatted = formatCountdown(secondsRemaining);

  return {
    secondsRemaining,
    epochNumber,
    formatted,
    epochDuration,
    epochStartTime,
  };
}
