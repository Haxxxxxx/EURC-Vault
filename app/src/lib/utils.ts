import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEurc(amount: number, decimals: number = 6): string {
  return (amount / Math.pow(10, decimals)).toFixed(2);
}

export function formatEurcDisplay(amount: number, decimals: number = 6): string {
  const formatted = parseFloat(formatEurc(amount, decimals));
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(formatted);
}

export function parseEurc(amount: string, decimals: number = 6): number {
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}

export function truncateAddress(address: string, startLength: number = 4, endLength: number = 4): string {
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function calculateProjectedEarnings(
  amount: number,
  apyPercent: number,
  daysInEpoch: number = 30
): {
  monthly: number;
  yearly: number;
} {
  const yearlyReturn = (amount * apyPercent) / 100;
  const monthlyReturn = yearlyReturn / 12;

  return {
    monthly: monthlyReturn,
    yearly: yearlyReturn,
  };
}

export function formatCountdown(seconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = seconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds: secs,
  };
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}
