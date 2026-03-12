import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function EurcVaultCard() {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const totalCapacity = 10000000;
  const currentCapacity = 6500000;
  const capacityPercentage = (currentCapacity / totalCapacity) * 100;
  const remainingSpace = totalCapacity - currentCapacity;
  
  const apy = 8.5;
  const estimatedGasFee = 2.45;

  const calculateMonthlyEarnings = (amount: string) => {
    const num = parseFloat(amount) || 0;
    return ((num * apy) / 100 / 12).toFixed(2);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border backdrop-blur-xl" 
         style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="mb-1 text-xl">Main EURC Stability Vault</h3>
            <p className="text-sm text-muted-foreground">Earn stable yields on your EURC holdings</p>
          </div>
          
          {/* APY Badge */}
          <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 px-4 py-2 text-right shadow-lg">
            <p className="text-xs text-accent-foreground/80">Current APY</p>
            <p className="text-2xl text-accent-foreground">{apy}%</p>
          </div>
        </div>

        {/* Capacity Progress */}
        <div className="mb-8 rounded-2xl border border-border bg-card/30 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vault Capacity</span>
            <span className="text-sm">
              €{currentCapacity.toLocaleString()} / €{totalCapacity.toLocaleString()}
            </span>
          </div>
          
          <Progress value={capacityPercentage} className="mb-2 h-2" />
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{capacityPercentage.toFixed(1)}% filled</span>
            <span className="text-accent">€{remainingSpace.toLocaleString()} remaining</span>
          </div>
        </div>

        {/* Deposit/Withdraw Tabs */}
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-2 rounded-2xl bg-secondary p-1">
            <TabsTrigger value="deposit" className="rounded-xl">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw" className="rounded-xl">Withdraw</TabsTrigger>
          </TabsList>

          {/* Deposit Tab */}
          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-border bg-card/50 px-4 py-4 pr-32 text-lg backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <button className="rounded-lg bg-secondary px-3 py-1 text-sm transition-colors hover:bg-secondary/80">
                    MAX
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                    <span>EURC</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Estimates */}
            <div className="space-y-3 rounded-2xl border border-border bg-card/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Gas fee
                  <Info className="h-3 w-3" />
                </span>
                <span>~€{estimatedGasFee}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Projected Monthly Earnings
                  <Info className="h-3 w-3" />
                </span>
                <span className="text-accent">+€{calculateMonthlyEarnings(depositAmount)}</span>
              </div>
            </div>

            <button className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/90 py-4 text-primary-foreground shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
                    disabled={!depositAmount || parseFloat(depositAmount) <= 0}>
              <span className="relative z-10">Deposit EURC</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Amount</label>
                <span className="text-xs text-muted-foreground">Available: €45,280.00</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-border bg-card/50 px-4 py-4 pr-32 text-lg backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <button className="rounded-lg bg-secondary px-3 py-1 text-sm transition-colors hover:bg-secondary/80">
                    MAX
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                    <span>EURC</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Estimates */}
            <div className="space-y-3 rounded-2xl border border-border bg-card/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Gas fee
                  <Info className="h-3 w-3" />
                </span>
                <span>~€{estimatedGasFee}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">You will receive</span>
                <span>{withdrawAmount ? `€${parseFloat(withdrawAmount).toFixed(2)}` : '€0.00'}</span>
              </div>
            </div>

            <button className="w-full rounded-2xl border-2 border-primary bg-transparent py-4 text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}>
              Withdraw EURC
            </button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Background gradient effect */}
      <div className="pointer-events-none absolute -left-32 -bottom-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
    </div>
  );
}
