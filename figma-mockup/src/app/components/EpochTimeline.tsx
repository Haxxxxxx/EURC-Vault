import { GlassCard } from './GlassCard';
import { CheckCircle, Circle, Clock } from '@phosphor-icons/react';

const epochs = [
  { number: 40, status: 'completed', date: 'Jan 15, 2026' },
  { number: 41, status: 'completed', date: 'Jan 22, 2026' },
  { number: 42, status: 'active', date: 'Feb 10, 2026' },
  { number: 43, status: 'upcoming', date: 'Feb 17, 2026' },
  { number: 44, status: 'upcoming', date: 'Feb 24, 2026' },
];

export function EpochTimeline() {
  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-medium mb-6">Staking Epoch Timeline</h3>
      
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />
        
        <div className="space-y-6">
          {epochs.map((epoch, index) => (
            <div key={epoch.number} className="relative flex items-start gap-4">
              {/* Icon */}
              <div className="relative z-10">
                {epoch.status === 'completed' && (
                  <CheckCircle className="w-12 h-12 text-accent" fill="currentColor" />
                )}
                {epoch.status === 'active' && (
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary-foreground animate-pulse" />
                  </div>
                )}
                {epoch.status === 'upcoming' && (
                  <Circle className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 pt-2">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium">
                    Epoch {epoch.number}
                    {epoch.status === 'active' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        Active
                      </span>
                    )}
                  </h4>
                  <span className="text-sm text-muted-foreground">{epoch.date}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {epoch.status === 'completed' && 'Rewards distributed'}
                  {epoch.status === 'active' && 'Current staking period - rewards accruing'}
                  {epoch.status === 'upcoming' && 'Upcoming staking period'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}