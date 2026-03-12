import { useEffect, useState } from 'react';

export function EpochCountdown() {
  const [time, setTime] = useState({ hours: 14, minutes: 22, seconds: 35 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 h-10 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm text-muted-foreground">Epoch 42 ends in:</span>
      </div>
      <span className="text-sm font-mono font-medium tabular-nums">
        {String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m
      </span>
    </div>
  );
}
