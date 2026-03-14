'use client';

import { PROTOCOL_META } from '@/lib/constants';
import type { ProtocolId } from '@/lib/types';

interface ProtocolIconProps {
  protocol: ProtocolId | 'idle';
  size?: number;
}

/** Drift — stylized "D" with momentum/drift lines */
function DriftIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Drift"
    >
      {/* Main D shape */}
      <path
        d="M10 6h6c5.523 0 10 4.477 10 16s-4.477 10-10 10h-6V6z"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="10" y1="6" x2="10" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Drift/momentum lines */}
      <line x1="3" y1="11" x2="8" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="4" y1="16" x2="8" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <line x1="3" y1="21" x2="8" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** Kamino — interlocking geometric prism / diamond shapes */
function KaminoIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kamino"
    >
      {/* Top diamond */}
      <path
        d="M16 3L24 12L16 21L8 12Z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Bottom diamond, overlapping */}
      <path
        d="M16 11L24 20L16 29L8 20Z"
        fill={color}
        fillOpacity="0.25"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Center accent line */}
      <line x1="16" y1="12" x2="16" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Save — shield with a check mark / vault motif */
function SaveIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Save"
    >
      {/* Shield outline */}
      <path
        d="M16 3L27 8V16C27 22.075 22.075 28 16 29C9.925 28 5 22.075 5 16V8L16 3Z"
        fill={color}
        fillOpacity="0.12"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Checkmark inside shield */}
      <path
        d="M11 16L14.5 19.5L21 13"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProtocolIcon({ protocol, size = 20 }: ProtocolIconProps) {
  const color = PROTOCOL_META[protocol].color;

  switch (protocol) {
    case 'drift':
      return <DriftIcon size={size} color={color} />;
    case 'kamino':
      return <KaminoIcon size={size} color={color} />;
    case 'save':
      return <SaveIcon size={size} color={color} />;
    default:
      // Idle or unknown — render a simple circle
      return (
        <span
          className="inline-block rounded-full"
          style={{ width: size, height: size, backgroundColor: color, opacity: 0.6 }}
          aria-label={protocol}
        />
      );
  }
}
