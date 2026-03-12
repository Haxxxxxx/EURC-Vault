import { useState, useEffect } from 'react';
import { EPOCH_DURATION } from '@/lib/constants';
import { formatCountdown } from '@/lib/utils';

export function useEpochCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [epochNumber, setEpochNumber] = useState<number>(1);

  useEffect(() => {
    const mockEpochStart = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const mockEpochEnd = mockEpochStart + EPOCH_DURATION * 1000;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((mockEpochEnd - now) / 1000));
      setSecondsRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatted = formatCountdown(secondsRemaining);

  return {
    secondsRemaining,
    epochNumber,
    formatted,
  };
}
