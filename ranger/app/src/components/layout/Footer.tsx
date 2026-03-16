'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-6">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-emerald-500/20">
                <Zap className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">Ranger Earn</span>
              <span className="text-xs text-muted-foreground/60">EURC Yield Optimizer</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-5">
              <Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link href="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </Link>
              <Link href="/simulator" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Simulator
              </Link>
              <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/account" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Account
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/60">
            <span>Built on Solana · Powered by Voltr · Ranger Build-A-Bear Hackathon 2026</span>
            <span>0.5% management · 10% performance · No hidden fees</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
