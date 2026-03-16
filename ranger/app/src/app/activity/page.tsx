'use client';

import { useState } from 'react';
import {
  ArrowRightLeft,
  Coins,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PROTOCOL_META, explorerTxUrl } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { ActivityEvent, ActivityEventType } from '@/lib/types';
import { clsx } from 'clsx';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<ActivityEventType, {
  icon: typeof ArrowRightLeft;
  color: string;
  bgColor: string;
  ringColor: string;
}> = {
  rebalance:    { icon: ArrowRightLeft, color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    ringColor: 'ring-blue-500/20'    },
  compound:     { icon: Coins,          color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', ringColor: 'ring-emerald-500/20' },
  rate_alert:   { icon: TrendingUp,     color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   ringColor: 'ring-amber-500/20'   },
  health_check: { icon: ShieldCheck,    color: 'text-violet-400',  bgColor: 'bg-violet-500/10',  ringColor: 'ring-violet-500/20'  },
  deposit:      { icon: Coins,          color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', ringColor: 'ring-emerald-500/20' },
  withdraw:     { icon: Coins,          color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  ringColor: 'ring-orange-500/20'  },
};

const FILTER_OPTIONS: { label: string; value: ActivityEventType | 'all' }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Rebalances',  value: 'rebalance' },
  { label: 'Compounds',   value: 'compound' },
  { label: 'Rate Alerts', value: 'rate_alert' },
  { label: 'Health',      value: 'health_check' },
];


// ─── Event card ──────────────────────────────────────────────────────────────

function EventCard({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="group relative flex gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/20 hover:shadow-sm transition-all duration-150">
      {/* Icon */}
      <div className={clsx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
        config.bgColor,
        config.ringColor,
      )}>
        <Icon className={clsx('h-5 w-5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {event.title}
          </h3>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo(event.timestamp)}
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {event.description}
        </p>

        {/* Metadata chips */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {event.protocol && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: PROTOCOL_META[event.protocol].color,
                backgroundColor: `${PROTOCOL_META[event.protocol].color}15`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: PROTOCOL_META[event.protocol].color }}
              />
              {PROTOCOL_META[event.protocol].label}
            </span>
          )}
          {event.amountEurc && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {event.amountEurc >= 1_000
                ? `€${(event.amountEurc / 1_000).toFixed(1)}K`
                : `€${event.amountEurc.toFixed(2)}`}
            </span>
          )}
          {event.gainBps !== undefined && event.gainBps > 0 && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              +{event.gainBps} bps
            </span>
          )}
          {event.txSig && (
            <a
              href={explorerTxUrl(event.txSig!)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Tx
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  usePageTitle('Activity');
  const { events, loading } = useActivityFeed(50);
  const [filter, setFilter] = useState<ActivityEventType | 'all'>('all');

  const filtered = filter === 'all'
    ? events
    : events.filter((e) => e.type === filter);

  const { rebalanceCount, compoundCount, totalGainBps } = events.reduce(
    (acc, e) => {
      if (e.type === 'rebalance') acc.rebalanceCount++;
      if (e.type === 'compound') acc.compoundCount++;
      if (e.gainBps) acc.totalGainBps += e.gainBps;
      return acc;
    },
    { rebalanceCount: 0, compoundCount: 0, totalGainBps: 0 },
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Strategy Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time feed of every bot decision — full transparency into how your yield is optimized
            </p>
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Live feed</span>
            </div>
          )}
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Rebalances</p>
            <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">
              {rebalanceCount}
            </p>
            <p className="text-[10px] text-muted-foreground">in last 6h</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Compounds</p>
            <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">
              {compoundCount}
            </p>
            <p className="text-[10px] text-muted-foreground">auto-reinvested</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Yield Gained</p>
            <p className="text-xl font-bold tabular-nums text-emerald-400 mt-0.5">
              +{totalGainBps} bps
            </p>
            <p className="text-[10px] text-muted-foreground">from rebalances</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap sm:gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                aria-label={`Filter by ${opt.label}`}
                aria-pressed={filter === opt.value}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  filter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event list */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-secondary animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-secondary animate-pulse" />
                    <div className="h-3 w-full rounded bg-secondary animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-secondary animate-pulse" />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                {filter === 'all' ? 'No activity yet' : `No ${filter.replace('_', ' ')} events`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === 'all'
                  ? 'Events will appear here once the bot starts monitoring and rebalancing'
                  : 'Try selecting "All" to see all event types'}
              </p>
            </div>
          ) : (
            filtered.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </div>
      </main>
    </div>
  );
}
