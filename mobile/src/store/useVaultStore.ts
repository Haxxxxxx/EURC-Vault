import { create } from 'zustand';

export interface VaultInfo {
  id: string;
  name: string;
  apy: number;
  totalDeposits: number;
  maxCapacity: number;
  stakerCount: number;
  currentEpoch: number;
  epochStartTime: number;
  epochDuration: number;
  withdrawalCooldown: number;
  paused: boolean;
}

export interface UserStakeInfo {
  vaultId: string;
  depositedAmount: number;
  pendingRewards: number;
  totalRewardsClaimed: number;
  pendingWithdrawalAmount: number;
  withdrawalAvailableAt: number;
}

export interface TransactionRecord {
  id: string;
  type: 'deposit' | 'withdrawal' | 'reward_claim' | 'emergency';
  amount: number;
  timestamp: number;
  vaultId: string;
  txHash: string;
  status: 'confirmed' | 'pending' | 'failed';
}

interface VaultState {
  vaults: VaultInfo[];
  userStakes: Record<string, UserStakeInfo>;
  transactions: TransactionRecord[];
  selectedVaultId: string | null;
  walletAddress: string | null;
  isConnected: boolean;
  isDarkMode: boolean;

  selectVault: (id: string) => void;
  setWalletAddress: (address: string | null) => void;
  toggleTheme: () => void;
  refreshVaults: () => Promise<void>;
}

// Mock data for development
const MOCK_VAULTS: VaultInfo[] = [
  {
    id: 'vault-1',
    name: 'EURC Stability Vault',
    apy: 8.5,
    totalDeposits: 2_450_000_000_000, // 2.45M EURC
    maxCapacity: 10_000_000_000_000,  // 10M EURC
    stakerCount: 342,
    currentEpoch: 12,
    epochStartTime: Math.floor(Date.now() / 1000) - 3 * 86400, // 3 days ago
    epochDuration: 7 * 86400,
    withdrawalCooldown: 86400,
    paused: false,
  },
  {
    id: 'vault-2',
    name: 'EURC Growth Vault',
    apy: 12.3,
    totalDeposits: 890_000_000_000,   // 890K EURC
    maxCapacity: 5_000_000_000_000,   // 5M EURC
    stakerCount: 156,
    currentEpoch: 8,
    epochStartTime: Math.floor(Date.now() / 1000) - 5 * 86400,
    epochDuration: 7 * 86400,
    withdrawalCooldown: 3 * 86400,
    paused: false,
  },
];

const MOCK_STAKES: Record<string, UserStakeInfo> = {
  'vault-1': {
    vaultId: 'vault-1',
    depositedAmount: 50_000_000_000, // 50K EURC
    pendingRewards: 354_000_000,     // 354 EURC
    totalRewardsClaimed: 2_100_000_000,
    pendingWithdrawalAmount: 0,
    withdrawalAvailableAt: 0,
  },
  'vault-2': {
    vaultId: 'vault-2',
    depositedAmount: 10_000_000_000, // 10K EURC
    pendingRewards: 102_000_000,     // 102 EURC
    totalRewardsClaimed: 450_000_000,
    pendingWithdrawalAmount: 0,
    withdrawalAvailableAt: 0,
  },
};

const MOCK_TRANSACTIONS: TransactionRecord[] = [
  {
    id: '1',
    type: 'deposit',
    amount: 25_000_000_000,
    timestamp: Date.now() - 2 * 86400_000,
    vaultId: 'vault-1',
    txHash: '5xGh...9kLm',
    status: 'confirmed',
  },
  {
    id: '2',
    type: 'reward_claim',
    amount: 1_050_000_000,
    timestamp: Date.now() - 5 * 86400_000,
    vaultId: 'vault-1',
    txHash: '3jRn...4pQw',
    status: 'confirmed',
  },
  {
    id: '3',
    type: 'deposit',
    amount: 10_000_000_000,
    timestamp: Date.now() - 7 * 86400_000,
    vaultId: 'vault-2',
    txHash: '8mKv...2nXr',
    status: 'confirmed',
  },
  {
    id: '4',
    type: 'withdrawal',
    amount: 5_000_000_000,
    timestamp: Date.now() - 10 * 86400_000,
    vaultId: 'vault-1',
    txHash: '1aFg...7sTb',
    status: 'confirmed',
  },
];

export const useVaultStore = create<VaultState>((set) => ({
  vaults: MOCK_VAULTS,
  userStakes: MOCK_STAKES,
  transactions: MOCK_TRANSACTIONS,
  selectedVaultId: null,
  walletAddress: null,
  isConnected: false,
  isDarkMode: true,

  selectVault: (id) => set({ selectedVaultId: id }),

  setWalletAddress: (address) =>
    set({ walletAddress: address, isConnected: !!address }),

  toggleTheme: () => set((s) => ({ isDarkMode: !s.isDarkMode })),

  refreshVaults: async () => {
    // TODO: Replace with actual on-chain fetch
    await new Promise((r) => setTimeout(r, 500));
    set({ vaults: MOCK_VAULTS, userStakes: MOCK_STAKES });
  },
}));
