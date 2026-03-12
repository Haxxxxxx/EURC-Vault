import { TrendingUp, Users, Wallet, Activity } from 'lucide-react';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

function StatCard({ icon: Icon, label, value, change, changeType = 'positive' }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border p-6 backdrop-blur-xl transition-all hover:shadow-lg" 
         style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
      <div className="relative z-10">
        <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        
        <p className="mb-1 text-sm text-muted-foreground">{label}</p>
        <p className="mb-2 text-2xl">{value}</p>
        
        {change && (
          <div className={`flex items-center gap-1 text-xs ${
            changeType === 'positive' ? 'text-accent' : 
            changeType === 'negative' ? 'text-destructive' : 
            'text-muted-foreground'
          }`}>
            {changeType === 'positive' && <TrendingUp className="h-3 w-3" />}
            <span>{change}</span>
          </div>
        )}
      </div>
      
      {/* Hover effect */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      </div>
    </div>
  );
}

export function StatsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Wallet}
        label="Your Staked EURC"
        value="€45,280"
        change="+€3,200 rewards"
        changeType="positive"
      />
      
      <StatCard
        icon={TrendingUp}
        label="Total Earnings"
        value="€3,850"
        change="All-time rewards"
        changeType="neutral"
      />
      
      <StatCard
        icon={Users}
        label="Active Stakers"
        value="1,247"
        change="+24 this week"
        changeType="positive"
      />
      
      <StatCard
        icon={Activity}
        label="Total Value Locked"
        value="€6.5M"
        change="65% capacity"
        changeType="neutral"
      />
    </div>
  );
}
