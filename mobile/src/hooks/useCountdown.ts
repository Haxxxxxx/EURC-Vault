import { useState, useEffect, useRef } from 'react';

export function useCountdown(epochStartTime: number, epochDuration: number) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const calculate = () => {
      const epochEndTime = epochStartTime + epochDuration;
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, epochEndTime - now);
      setSecondsRemaining(remaining);
    };

    calculate();
    intervalRef.current = setInterval(calculate, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [epochStartTime, epochDuration]);

  const progress = epochDuration > 0
    ? 1 - secondsRemaining / epochDuration
    : 0;

  return { secondsRemaining, progress };
}
