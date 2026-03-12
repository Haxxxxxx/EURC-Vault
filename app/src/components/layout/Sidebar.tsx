'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartLine, Vault, ClockCounterClockwise, Gear, Trophy, ArrowsDownUp, X, Terminal, ShieldCheck } from '@phosphor-icons/react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRouteProgress } from '@/providers/RouteProgressProvider';

const navItems = [
  { to: '/', icon: ChartLine, label: 'Portfolio' },
  { to: '/vaults', icon: Vault, label: 'Vaults' },
  { to: '/history', icon: ClockCounterClockwise, label: 'History' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/devnet', icon: Terminal, label: 'Devnet' },
  { to: '/settings', icon: Gear, label: 'Settings' },
];

const adminItem = { to: '/admin', icon: ShieldCheck, label: 'Admin' };

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useAdminAuth();
  const { startNavigation } = useRouteProgress();
  const allItems = isAdmin ? [...navItems, adminItem] : navItems;

  const handleNav = (href: string) => {
    if (href !== pathname) startNavigation();
    onClose?.();
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 md:px-0 md:justify-center">
        <Link href="/" className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary" onClick={() => handleNav('/')}>
          <span className="text-2xl font-semibold text-primary-foreground">&euro;</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 rounded-xl hover:bg-muted/60 text-foreground-secondary">
            <X className="w-5 h-5" weight="bold" />
          </button>
        )}
      </div>

      {/* Swap/Deposit Button */}
      <Link
        href="/deposit-withdraw/main-eurc-stability"
        onClick={() => handleNav('/deposit-withdraw/main-eurc-stability')}
        className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-accent/80 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 group relative self-center"
      >
        <ArrowsDownUp className="w-6 h-6" weight="bold" />
        <span className="absolute left-20 px-3 py-2 bg-card text-card-foreground rounded-lg shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Swap
        </span>
      </Link>

      <nav className="flex flex-col gap-4 flex-1 items-center">
        {allItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));

          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={() => handleNav(item.to)}
              className={cn(
                'relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary shadow-lg"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className="w-6 h-6 relative z-10" weight={isActive ? 'bold' : 'regular'} />
              <span className="absolute left-20 px-3 py-2 bg-card text-card-foreground rounded-lg shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-20 bg-sidebar border-r border-sidebar-border flex-col items-center py-6 gap-8">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -80 }}
              animate={{ x: 0 }}
              exit={{ x: -80 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 gap-8 z-50 md:hidden"
            >
              <SidebarContent onClose={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
