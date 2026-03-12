import { Wallet, Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from './ThemeProvider';
import { EpochCountdown } from './EpochCountdown';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-20 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-medium tracking-tight">EURC Vault</h1>
      </div>

      <div className="flex items-center gap-4">
        <EpochCountdown />
        
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Moon className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        <button className="flex items-center gap-2 px-6 h-10 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium hover:shadow-lg hover:scale-105 transition-all duration-200">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      </div>
    </header>
  );
}