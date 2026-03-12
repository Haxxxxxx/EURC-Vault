import { useState, useEffect } from 'react';
import { Moon, Sun, Wallet } from 'lucide-react';

interface TopBarProps {
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function TopBar({ theme, onThemeToggle }: TopBarProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 14,
    minutes: 22,
    seconds: 35
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="fixed left-20 right-0 top-0 z-10 border-b border-border backdrop-blur-xl" 
            style={{ background: 'var(--glass-bg)' }}>
      <div className="flex h-16 items-center justify-between px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl tracking-tight">EURC Vault</h1>
        </div>

        {/* Center - Epoch Countdown */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-6 py-2.5 backdrop-blur-sm">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
          </div>
          <span className="text-sm text-muted-foreground">Epoch 42 ends in:</span>
          <span className="font-mono tabular-nums">
            {String(timeLeft.hours).padStart(2, '0')}h{' '}
            {String(timeLeft.minutes).padStart(2, '0')}m{' '}
            {String(timeLeft.seconds).padStart(2, '0')}s
          </span>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:shadow-lg"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Connect Wallet Button */}
          <button className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/90 px-6 py-2.5 text-primary-foreground shadow-lg transition-all hover:shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" 
                 style={{ transform: 'translateX(-100%)', animation: 'shimmer 2s infinite' }} />
            <Wallet className="h-4 w-4" />
            <span>Connect Wallet</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </header>
  );
}
