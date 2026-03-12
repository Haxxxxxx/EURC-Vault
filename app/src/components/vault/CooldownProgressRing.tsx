'use client';

import { useEffect, useState } from 'react';

interface CooldownProgressRingProps {
  startTime: number; // unix timestamp
  endTime: number; // unix timestamp (withdrawalAvailableAt)
  size?: number;
}

export function CooldownProgressRing({
  startTime,
  endTime,
  size = 40,
}: CooldownProgressRingProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const total = endTime - startTime;
  const elapsed = Math.min(now - startTime, total);
  const progress = total > 0 ? elapsed / total : 0;
  const isComplete = now >= endTime;

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const remaining = Math.max(endTime - now, 0);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-muted"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={isComplete ? 'text-emerald-500' : 'text-amber-500'}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute text-[8px] font-medium text-foreground">
        {isComplete ? 'Done' : hours > 0 ? `${hours}h` : `${minutes}m`}
      </span>
    </div>
  );
}
