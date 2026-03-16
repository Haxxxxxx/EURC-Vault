'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Ranger Earn</span>
            <span className="text-xs text-muted-foreground">EURC Yield Optimizer</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
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
          </div>

          {/* Built on Solana */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Built on</span>
            <span className="font-medium text-foreground">Solana</span>
            <span className="text-muted-foreground/50">·</span>
            <span>Powered by</span>
            <span className="font-medium text-foreground">Voltr</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
