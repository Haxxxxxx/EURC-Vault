import { Check, Clock, Circle } from 'lucide-react';

interface EpochStep {
  id: number;
  label: string;
  date: string;
  status: 'completed' | 'active' | 'upcoming';
}

export function EpochTimeline() {
  const steps: EpochStep[] = [
    {
      id: 40,
      label: 'Epoch 40',
      date: 'Feb 4, 2026',
      status: 'completed'
    },
    {
      id: 41,
      label: 'Epoch 41',
      date: 'Feb 7, 2026',
      status: 'completed'
    },
    {
      id: 42,
      label: 'Epoch 42',
      date: 'Feb 10, 2026',
      status: 'active'
    },
    {
      id: 43,
      label: 'Epoch 43',
      date: 'Feb 13, 2026',
      status: 'upcoming'
    },
    {
      id: 44,
      label: 'Epoch 44',
      date: 'Feb 16, 2026',
      status: 'upcoming'
    }
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border backdrop-blur-xl" 
         style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="mb-1 text-xl">Epoch Timeline</h3>
            <p className="text-sm text-muted-foreground">Staking cycle and reward distribution</p>
          </div>
          
          <div className="rounded-xl bg-card/50 px-4 py-2">
            <span className="text-sm text-muted-foreground">3-day cycles</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="relative flex flex-col items-center">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-6 h-0.5 w-full"
                       style={{
                         background: step.status === 'completed' 
                           ? 'var(--emerald-green)' 
                           : step.status === 'active'
                           ? 'linear-gradient(to right, var(--emerald-green) 50%, var(--border) 50%)'
                           : 'var(--border)'
                       }}
                  />
                )}

                {/* Step Circle */}
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all ${
                  step.status === 'completed'
                    ? 'border-accent bg-accent text-accent-foreground shadow-lg shadow-accent/20'
                    : step.status === 'active'
                    ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 animate-pulse'
                    : 'border-border bg-card text-muted-foreground'
                }`}>
                  {step.status === 'completed' && <Check className="h-5 w-5" />}
                  {step.status === 'active' && <Clock className="h-5 w-5" />}
                  {step.status === 'upcoming' && <Circle className="h-5 w-5" />}
                </div>

                {/* Label */}
                <div className="mt-4 text-center">
                  <p className={`text-sm ${
                    step.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.date}</p>
                  
                  {step.status === 'active' && (
                    <div className="mt-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
                      In Progress
                    </div>
                  )}
                  
                  {step.status === 'completed' && (
                    <div className="mt-2 text-xs text-accent">
                      Rewards Paid
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-8 rounded-2xl border border-border bg-card/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="mb-1 text-sm">Next Reward Distribution</h4>
              <p className="text-xs text-muted-foreground">
                Epoch 42 rewards will be distributed automatically when the current cycle completes. 
                Your projected earnings: €385.50
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Background gradient effect */}
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
    </div>
  );
}
