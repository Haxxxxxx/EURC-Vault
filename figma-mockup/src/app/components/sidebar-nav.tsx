import { Wallet, Vault, History, Settings } from 'lucide-react';

interface SidebarNavProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

export function SidebarNav({ activeItem = 'portfolio', onItemClick }: SidebarNavProps) {
  const navItems = [
    { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
    { id: 'vaults', icon: Vault, label: 'Vaults' },
    { id: 'history', icon: History, label: 'History' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 border-r border-border backdrop-blur-xl" 
           style={{ background: 'var(--glass-bg)' }}>
      <div className="flex h-full flex-col items-center py-8">
        {/* Logo */}
        <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
          <div className="text-xl text-primary-foreground">€</div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onItemClick?.(item.id)}
                className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
                
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap rounded-lg bg-popover px-3 py-1.5 text-sm opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
