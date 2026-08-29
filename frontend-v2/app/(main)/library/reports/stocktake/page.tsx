'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  StocktakeSessionView,
  clearPersistedStocktakeSessionId,
  loadPersistedStocktakeSessionId,
  persistActiveStocktakeSessionId,
} from '@/components/elibrary/StocktakeSession';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import {
  useCompleteStocktake,
  useCurrentStocktakeSession,
  useLocationTree,
  useRecordStocktakeScan,
  useStartStocktake,
  useStocktakeSession,
} from '@/src/features/library/hooks';
import type { LocationSelection } from '@/src/features/library/types/library.types';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StocktakePage() {
  const [cachedSessionId, setCachedSessionId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const locations = useLocationTree();
  const currentSession = useCurrentStocktakeSession();
  const sessionQuery = useStocktakeSession(sessionId);
  const startStocktake = useStartStocktake();
  const recordScan = useRecordStocktakeScan();
  const completeStocktake = useCompleteStocktake();

  useEffect(() => {
    setCachedSessionId(loadPersistedStocktakeSessionId());
  }, []);

  useEffect(() => {
    if (currentSession.isLoading) return;
    if (currentSession.isSuccess) {
      if (currentSession.data?.id) {
        persistActiveStocktakeSessionId(currentSession.data.id);
        setSessionId(currentSession.data.id);
      } else {
        clearPersistedStocktakeSessionId();
        setSessionId(null);
      }
    } else if (cachedSessionId) {
      // Offline recovery: use the reference only to re-fetch from the API.
      // It is never treated as a session snapshot or sent back as an update.
      setSessionId(cachedSessionId);
    }
  }, [cachedSessionId, currentSession.data?.id, currentSession.isLoading, currentSession.isSuccess]);

  useEffect(() => {
    if (sessionQuery.data?.status === 'closed') clearPersistedStocktakeSessionId();
  }, [sessionQuery.data?.status]);

  const handleStartSession = useCallback(
    async (location: LocationSelection) => {
      try {
        const session = await startStocktake.mutateAsync(location);
        persistActiveStocktakeSessionId(session.id);
        setSessionId(session.id);
        return { success: true, session };
      } catch (error) {
        return { success: false, error: errorMessage(error, 'Unable to start stocktake session.') };
      }
    },
    [startStocktake]
  );

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!sessionId) return { success: false, error: 'No active session.' };
      try {
        const session = await recordScan.mutateAsync({
          sessionId,
          barcode,
          idempotencyKey: `${sessionId}:${barcode}`,
        });
        return { success: true, session, duplicate: session.duplicate };
      } catch (error) {
        return { success: false, error: errorMessage(error, 'Unable to record scan. Please try again.') };
      }
    },
    [recordScan, sessionId]
  );

  const handleComplete = useCallback(async (discrepanciesReviewed: boolean) => {
    if (!sessionId) return { success: false, error: 'No active session.' };
    try {
      const session = await completeStocktake.mutateAsync({ sessionId, discrepanciesReviewed });
      return { success: true, session };
    } catch (error) {
      return { success: false, error: errorMessage(error, 'Unable to close stocktake session.') };
    }
  }, [completeStocktake, sessionId]);

  return (
    <LibrarianLayout
      permissions={['reports', 'circulation']}
      activeHref="/library/reports/stocktake"
      title="Inventory stocktake"
    >
      <StocktakeSessionView
        nodes={locations.data ?? []}
        session={sessionQuery.data ?? currentSession.data ?? null}
        isLoading={locations.isLoading || currentSession.isLoading || Boolean(sessionId && sessionQuery.isLoading)}
        error={sessionQuery.error ? errorMessage(sessionQuery.error, 'Unable to load stocktake session.') : !cachedSessionId && currentSession.error ? errorMessage(currentSession.error, 'Unable to resume stocktake session.') : null}
        locationsLoading={locations.isLoading}
        locationsError={locations.error ? errorMessage(locations.error, 'Unable to load locations.') : null}
        onStartSession={handleStartSession}
        onScan={handleScan}
        onComplete={handleComplete}
      />
    </LibrarianLayout>
  );
}
