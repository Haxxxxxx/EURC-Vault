import { EURC_DECIMALS } from './constants';

const EURC_FACTOR = Math.pow(10, EURC_DECIMALS);

export function formatEurc(baseUnits: number, showSymbol = true): string {
  const value = baseUnits / EURC_FACTOR;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return showSymbol ? `${formatted} EURC` : formatted;
}

export function formatEurcCompact(baseUnits: number): string {
  const value = baseUnits / EURC_FACTOR;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

export function formatApy(apy: number): string {
  return `${apy.toFixed(2)}%`;
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00:00';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
