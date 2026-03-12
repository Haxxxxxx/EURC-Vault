/**
 * Alert system — Discord and Telegram webhooks for rebalances, risk events,
 * circuit breaker trips, and compound events.
 */
import { DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';
import logger from './logger.js';

const log = logger.child('monitoring:alerts');

export type AlertLevel = 'INFO' | 'WARN' | 'ERROR' | 'EMERGENCY';

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  fields?: Record<string, string>;
}

const levelColor: Record<AlertLevel, number> = {
  INFO:      0x00bfff, // blue
  WARN:      0xffa500, // orange
  ERROR:     0xff4444, // red
  EMERGENCY: 0x8b0000, // dark red
};

const levelEmoji: Record<AlertLevel, string> = {
  INFO:      'ℹ️',
  WARN:      '⚠️',
  ERROR:     '🔴',
  EMERGENCY: '🚨',
};

async function sendDiscord(payload: AlertPayload): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;

  const embed = {
    title:       `${levelEmoji[payload.level]} ${payload.title}`,
    description: payload.message,
    color:       levelColor[payload.level],
    timestamp:   new Date().toISOString(),
    fields:      payload.fields
      ? Object.entries(payload.fields).map(([name, value]) => ({
          name,
          value,
          inline: true,
        }))
      : [],
    footer: { text: 'EURC Yield Optimizer' },
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [embed] }),
      signal:  AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      log.warn('Discord webhook returned non-200', { status: res.status });
    }
  } catch (err) {
    log.error('Discord webhook failed', err);
  }
}

async function sendTelegram(payload: AlertPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const fields = payload.fields
    ? Object.entries(payload.fields)
        .map(([k, v]) => `• *${k}:* ${v}`)
        .join('\n')
    : '';

  const text = [
    `${levelEmoji[payload.level]} *${payload.title}*`,
    payload.message,
    fields,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      log.warn('Telegram API returned non-200', { status: res.status });
    }
  } catch (err) {
    log.error('Telegram alert failed', err);
  }
}

/**
 * Send an alert to all configured channels (Discord, Telegram).
 * Never throws — alert failures are logged but don't crash the bot.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  log.info('Sending alert', { level: payload.level, title: payload.title });

  await Promise.allSettled([
    sendDiscord(payload),
    sendTelegram(payload),
  ]);
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

export function alertRebalance(
  from: string,
  to: string,
  amountEurc: number,
  spreadBps: number,
  txSig: string,
): Promise<void> {
  return sendAlert({
    level:   'INFO',
    title:   'Rebalance Executed',
    message: `Moved ${(amountEurc / 1_000_000).toFixed(2)} EURC from ${from} → ${to}`,
    fields: {
      Spread:      `${spreadBps} bps`,
      Amount:      `${(amountEurc / 1_000_000).toFixed(2)} EURC`,
      Transaction: txSig.slice(0, 20) + '...',
    },
  });
}

export function alertCompound(
  protocol: string,
  harvestedEurc: number,
  txSig: string,
): Promise<void> {
  return sendAlert({
    level:   'INFO',
    title:   'Auto-Compound Executed',
    message: `Harvested ${(harvestedEurc / 1_000_000).toFixed(4)} EURC and re-deposited to ${protocol}`,
    fields: {
      Harvested:   `${(harvestedEurc / 1_000_000).toFixed(4)} EURC`,
      Transaction: txSig.slice(0, 20) + '...',
    },
  });
}

export function alertRiskWarning(warnings: string[]): Promise<void> {
  return sendAlert({
    level:   'WARN',
    title:   'Risk Warning',
    message: warnings.join('\n'),
  });
}
