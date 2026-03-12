'use client';

import { FundRewardsForm } from '@/components/admin/FundRewardsForm';
import { EpochManagementPanel } from '@/components/admin/EpochManagementPanel';

export default function FundRewardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fund Rewards & Epochs</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Fund the reward pool and manage epoch transitions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FundRewardsForm />
        <EpochManagementPanel />
      </div>
    </div>
  );
}
