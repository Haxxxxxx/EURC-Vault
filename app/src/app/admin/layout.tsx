'use client';

import { AdminGate } from '@/components/admin/AdminGate';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </AdminGate>
  );
}
