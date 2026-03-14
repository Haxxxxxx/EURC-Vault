'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Zap } from 'lucide-react';
import { clsx } from 'clsx';

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { label: 'Vault',      href: '/'           },
    { label: 'Dashboard',  href: '/dashboard'  },
    { label: 'Analytics',  href: '/analytics'  },
    { label: 'Simulator',  href: '/simulator'  },
    { label: 'Activity',   href: '/activity'   },
    { label: 'Docs',       href: '/docs'       },
    { label: 'Deposit',    href: '/deposit'    },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-glass">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/20 ring-1 ring-primary/20 group-hover:ring-primary/40 transition-all">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-foreground tracking-tight">EURC Optimizer</span>
              <span className="text-[10px] font-medium text-primary/70">Ranger Earn Vault</span>
            </div>
          </Link>

          {/* Center: Nav links */}
          <div className="hidden md:flex items-center gap-0.5 rounded-lg bg-secondary/50 p-1">
            {navLinks.map(({ label, href }) => {
              const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'rounded-md px-3 lg:px-4 py-1.5 text-xs lg:text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right: Wallet button */}
          <div className="flex items-center">
            <WalletMultiButton
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                height: '2.25rem',
                padding: '0 1rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Mobile nav links — horizontally scrollable */}
        <div className="flex md:hidden items-center gap-1 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {navLinks.map(({ label, href }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
