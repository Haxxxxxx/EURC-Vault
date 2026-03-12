'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Vault, History, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Portfolio', href: '/', icon: LayoutDashboard },
  { label: 'Vaults', href: '/vaults', icon: Vault },
  { label: 'History', href: '/history', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 bg-background-surface border-r border-glass-border z-40">
      <Link href="/" className="mb-12">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-xl">€</span>
        </div>
      </Link>

      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex flex-col items-center gap-1 px-3 py-4 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-glass text-primary'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-glass/50'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>

              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
