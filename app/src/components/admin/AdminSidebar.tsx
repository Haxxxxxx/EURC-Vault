'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ChartBar,
  CurrencyEur,
  GearSix,
  UsersThree,
  ShieldCheck,
} from '@phosphor-icons/react';

const adminNav = [
  { href: '/admin', icon: ChartBar, label: 'Dashboard' },
  { href: '/admin/fund-rewards', icon: CurrencyEur, label: 'Fund Rewards' },
  { href: '/admin/config', icon: GearSix, label: 'Configuration' },
  { href: '/admin/participants', icon: UsersThree, label: 'Participants' },
  { href: '/admin/authority', icon: ShieldCheck, label: 'Authority' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 border-r border-border bg-card/50 p-4 space-y-1 hidden lg:block">
      <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider px-3 mb-3">
        Admin Panel
      </p>
      {adminNav.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground-secondary hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="w-5 h-5" weight={isActive ? 'bold' : 'regular'} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
