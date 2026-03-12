'use client';

import { VaultConfigForm } from '@/components/admin/VaultConfigForm';

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vault Configuration</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Update vault parameters and manage pause state
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-6">
          <VaultConfigForm />
        </div>
      </div>
    </div>
  );
}
