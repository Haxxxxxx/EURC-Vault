'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Clock,
  CurrencyEur,
  CheckCircle,
  XCircle,
  ShieldWarning,
  Info,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// ---------- Helpers ----------

const TYPE_CONFIG: Record<
  Notification['type'],
  { icon: typeof Bell; colorClass: string }
> = {
  epoch: { icon: Clock, colorClass: 'text-primary' },
  reward: { icon: CurrencyEur, colorClass: 'text-success' },
  tx_confirmed: { icon: CheckCircle, colorClass: 'text-success' },
  tx_failed: { icon: XCircle, colorClass: 'text-destructive' },
  security: { icon: ShieldWarning, colorClass: 'text-warning' },
  info: { icon: Info, colorClass: 'text-foreground-secondary' },
};

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

// ---------- Component ----------

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
      setOpen(false);
    },
    [markAsRead, router],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const recentNotifications = notifications.slice(0, 10);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-muted-foreground" weight={unreadCount > 0 ? 'fill' : 'regular'} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-error rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-2xl border border-glass-border shadow-xl overflow-hidden"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <span className="text-sm text-muted-foreground">
                  Loading...
                </span>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <span className="text-sm text-muted-foreground">
                  No notifications
                </span>
              </div>
            ) : (
              recentNotifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type];
                const Icon = config.icon;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      !notification.read && 'bg-primary/5',
                    )}
                  >
                    {/* Unread indicator */}
                    <div className="flex-shrink-0 mt-1.5 w-2 h-2">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>

                    {/* Type icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon
                        className={cn('w-5 h-5', config.colorClass)}
                        weight="fill"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
