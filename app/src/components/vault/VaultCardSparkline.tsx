'use client';

interface VaultCardSparklineProps {
  /** APY values for the last N epochs */
  data: number[];
  width?: number;
  height?: number;
}

export function VaultCardSparkline({
  data,
  width = 80,
  height = 24,
}: VaultCardSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={isUp ? '#10B981' : '#EF4444'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
