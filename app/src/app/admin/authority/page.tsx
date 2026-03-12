'use client';

import { AuthorityTransferPanel } from '@/components/admin/AuthorityTransferPanel';

export default function AuthorityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Authority Transfer</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Initiate a 2-step vault authority transfer
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-6">
          <AuthorityTransferPanel />
        </div>
      </div>
    </div>
  );
}
