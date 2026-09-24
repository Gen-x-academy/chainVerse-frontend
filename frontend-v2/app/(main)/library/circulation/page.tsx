'use client';

import React from 'react';
import { PhysicalCheckoutFlow } from '@/components/elibrary/PhysicalCheckoutFlow';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import { useLibrarianPermissions } from '@/src/features/library/hooks/useLibrarianPermissions';

export default function CirculationPage() {
  const permissions = useLibrarianPermissions();
  const canUseDesk = permissions.includes('circulation');

  return (
    <LibrarianLayout
      permissions={permissions}
      activeHref="/library/circulation"
      title="Circulation desk"
    >
      {canUseDesk ? (
        <PhysicalCheckoutFlow />
      ) : (
        <div role="alert" className="rounded-md border p-6">
          <h2 className="text-lg font-semibold">Access denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have permission to use the circulation desk.
          </p>
        </div>
      )}
    </LibrarianLayout>
  );
}
