import { useState } from 'react';
import { useParams } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { GasPump, Info, ArrowsDownUp, CaretDown } from '@phosphor-icons/react';

const vaultData: Record<string, any> = {
  'main-stability': {
    name: 'Main EURC Stability Vault',
    apy: 8.45,
  },
  'high-yield': {
    name: 'High Yield EURC Pool',
    apy: 12.8,
  },
  'premium-locked': {
    name: 'Premium Locked Staking',
    apy: 15.5,
  },
  'conservative': {
    name: 'Conservative Reserve Vault',
    apy: 5.2,
  },
};

export function DepositWithdraw() {
  const { vaultId } = useParams();
  const vault = vaultData[vaultId || 'main-stability'];
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  const userBalance = 40000;
  const userStaked = 25000;
  const monthlyEarnings = amount ? (parseFloat(amount) * (vault.apy / 100)) / 12 : 0;
  const yearlyEarnings = amount ? parseFloat(amount) * (vault.apy / 100) : 0;

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Main Swap Card */}
        <GlassCard className="p-6 backdrop-blur-2xl">
          {/* Header with Tab Toggle */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-medium">Swap</h1>
            
            {/* Compact Tab Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl">
              <button
                onClick={() => setActiveTab('deposit')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'deposit'
                    ? 'bg-accent text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'withdraw'
                    ? 'bg-accent text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Available Balance */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {activeTab === 'deposit' ? 'Available:' : 'Staked:'}
            </span>
            <span className="text-sm font-medium">
              {activeTab === 'deposit' ? userBalance.toLocaleString() : userStaked.toLocaleString()} EURC
            </span>
          </div>

          {/* From/To Input */}
          <div className="space-y-3 mb-4">
            {/* Input Field */}
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow only numbers and decimal point
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                  }
                }}
                placeholder="0"
                className="w-full h-20 px-4 pr-32 text-3xl font-light bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              />
              
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={() => setAmount(activeTab === 'deposit' ? userBalance.toString() : userStaked.toString())}
                  className="px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 rounded-lg transition-colors uppercase"
                >
                  Max
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 rounded-xl transition-colors">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-xs font-bold text-white">€</span>
                  </div>
                  <span className="text-sm font-medium">EURC</span>
                  <CaretDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Conversion Info */}
            {amount && parseFloat(amount) > 0 && (
              <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                <span>1 EURC = 1.067 USD</span>
              </div>
            )}
          </div>

          {/* Swap Icon Divider */}
          <div className="flex justify-center -my-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <ArrowsDownUp className="w-5 h-5 text-muted-foreground" weight="bold" />
            </div>
          </div>

          {/* To Field */}
          <div className="relative mb-6">
            <div className="w-full h-20 px-4 flex items-center justify-between bg-muted/30 border border-border rounded-2xl">
              <span className="text-3xl font-light text-muted-foreground">
                {amount || '0'}
              </span>
              <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">v</span>
                </div>
                <span className="text-sm font-medium">v{vault.name.split(' ')[0]}</span>
              </div>
            </div>
            <div className="absolute -bottom-5 right-4 text-xs text-muted-foreground">
              * estimated amount received
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-2 mb-6 pt-4">
            <button className="w-full flex items-center justify-between text-sm py-2 hover:bg-muted/20 rounded-lg px-2 transition-colors">
              <span className="text-muted-foreground">Show swap details</span>
              <CaretDown className="w-4 h-4 text-accent" />
            </button>
          </div>

          {/* Projected Earnings for Deposit */}
          {activeTab === 'deposit' && amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 rounded-xl mb-6">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Projected Earnings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Monthly</div>
                  <div className="text-xl font-light text-accent">+{monthlyEarnings.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">EURC</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Yearly (APY {vault.apy}%)</div>
                  <div className="text-xl font-light text-accent">+{yearlyEarnings.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">EURC</div>
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Notice */}
          {activeTab === 'withdraw' && (
            <div className="flex items-start gap-2 p-4 bg-primary/10 border border-primary/20 rounded-xl mb-6">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Instant Withdrawal</p>
                <p className="text-muted-foreground text-xs">
                  Your funds and unclaimed rewards will be sent to your wallet immediately.
                </p>
              </div>
            </div>
          )}

          {/* Connect/Confirm Button */}
          <button
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full h-14 bg-gradient-to-r from-accent to-accent/90 text-white font-medium rounded-2xl hover:shadow-xl hover:shadow-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none text-base"
          >
            {activeTab === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
          </button>

          {/* Gas Fee Info */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <GasPump className="w-3.5 h-3.5" />
            <span>Estimated gas: ~0.002 ETH</span>
          </div>
        </GlassCard>

        {/* Info Cards Below */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <GlassCard className="p-4 backdrop-blur-xl">
            <h3 className="text-sm font-medium mb-2">Current APY</h3>
            <div className="text-2xl font-light text-accent">{vault.apy}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Earn competitive returns
            </p>
          </GlassCard>

          <GlassCard className="p-4 backdrop-blur-xl">
            <h3 className="text-sm font-medium mb-2">Vault TVL</h3>
            <div className="text-2xl font-light">€6.5M</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total value locked
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}