'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  StocktakeSessionView,
  loadPersistedStocktakeSession,
} from '@/components/elibrary/StocktakeSession';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import {
  MOCK_LOCATION_TREE,
  mockStartStocktake,
  mockStocktakeScan,
} from '@/src/features/library/utils/mockLibraryData';
import type { LocationSelection, StocktakeSession } from '@/src/features/library/types/library.types';

export default function StocktakePage() {
  const [session, setSession] = useState<StocktakeSession | null>(null);

  useEffect(() => {
    const persisted = loadPersistedStocktakeSession();
    if (persisted && persisted.status !== 'closed') {
      setSession(persisted);
    }
  }, []);

  const handleStartSession = useCallback(
    async (location: LocationSelection, locationLabel: string) => {
      const newSession = mockStartStocktake(locationLabel);
      newSession.location = location;
      setSession(newSession);
      return { success: true, session: newSession };
    },
    []
  );

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!session) return { success: false, error: 'No session' };
      const updated = mockStocktakeScan(session, barcode);
      setSession(updated);
      const item = updated.scannedItems.find((s) => s.barcode === barcode);
      return { success: true, item };
    },
    [session]
  );

  const handleComplete = useCallback(async () => {
    if (!session) return { success: false, error: 'No session' };
    if (session.discrepancies.length > 0) {
      // require review step in component
    }
    setSession({ ...session, status: 'closed' });
    return { success: true };
  }, [session]);

  return (
    <LibrarianLayout
      permissions={['reports', 'circulation']}
      activeHref="/library/reports/stocktake"
      title="Inventory stocktake"
    >
      <StocktakeSessionView
        nodes={MOCK_LOCATION_TREE}
        session={session}
        onStartSession={handleStartSession}
        onScan={handleScan}
        onComplete={handleComplete}
      />
    </LibrarianLayout>
  );
}
