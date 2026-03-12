import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const sparklineData = [
  { value: 100000 },
  { value: 105000 },
  { value: 103000 },
  { value: 108000 },
  { value: 112000 },
  { value: 110000 },
  { value: 115000 },
  { value: 118000 },
  { value: 120000 },
  { value: 125000 },
  { value: 123000 },
  { value: 128500 },
];

export function PortfolioOverview() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border p-8 backdrop-blur-xl" 
         style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-2 text-sm text-muted-foreground">Total Balance</p>
          <h2 className="mb-4 text-5xl tracking-tight">€128,500.00</h2>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-accent">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+12.8%</span>
            </div>
            <span className="text-muted-foreground">vs. last month</span>
          </div>
        </div>

        {/* Mini Sparkline */}
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-muted-foreground">Portfolio Evolution</p>
          <div className="h-20 w-48 rounded-xl bg-card/30 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--emerald-green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--emerald-green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--emerald-green)" 
                  strokeWidth={2}
                  fill="url(#portfolioGradient)" 
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Background gradient effect */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
    </div>
  );
}
