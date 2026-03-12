'use client';

import { ParticipantTable } from '@/components/admin/ParticipantTable';

export default function ParticipantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Participants</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          View all stakers and their positions across vaults
        </p>
      </div>

      <ParticipantTable />
    </div>
  );
}
