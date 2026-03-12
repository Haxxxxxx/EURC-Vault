import { NavLink, Link } from 'react-router';
import { ChartLine, Vault, ClockCounterClockwise, Gear, Trophy, ArrowsDownUp } from '@phosphor-icons/react';

const navItems = [
  { to: '/', icon: ChartLine, label: 'Portfolio' },
  { to: '/vaults', icon: Vault, label: 'Vaults' },
  { to: '/history', icon: ClockCounterClockwise, label: 'History' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/settings', icon: Gear, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 gap-8">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary">
        <span className="text-2xl font-semibold text-primary-foreground">€</span>
      </div>
      
      {/* Prominent Swap/Deposit Button */}
      <Link
        to="/deposit-withdraw/main-stability"
        className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-accent/80 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 group relative"
      >
        <ArrowsDownUp className="w-6 h-6" weight="bold" />
        <span className="absolute left-20 px-3 py-2 bg-card text-card-foreground rounded-lg shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Swap
        </span>
      </Link>
      
      <nav className="flex flex-col gap-4 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="absolute left-20 px-3 py-2 bg-card text-card-foreground rounded-lg shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}