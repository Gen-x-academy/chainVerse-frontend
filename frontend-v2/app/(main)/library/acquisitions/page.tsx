'use client';

import { useCallback, useEffect, useState } from 'react';
import { AcquisitionQueue } from '@/components/elibrary/AcquisitionQueue';
import { DonationIntakeWorkflow } from '@/components/elibrary/DonationIntakeWorkflow';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import { hasLibrarianPermission, useLibrarianPermissions } from '@/src/features/library/hooks/useLibrarianPermissions';
import { libraryService } from '@/src/features/library/services/library.service';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';
import type { CatalogMatch, DonationIntakePayload, LocationNode } from '@/src/features/library/types/library.types';

/** Donation intake and the acquisition queue it creates records for. */
export default function AcquisitionsPage() {
  const permissions = useLibrarianPermissions();
  const canViewDonorDetails = hasLibrarianPermission(permissions, 'acquisitions');
  const [items, setItems] = useState<AcquisitionQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [locationNodes, setLocationNodes] = useState<LocationNode[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [matches, setMatches] = useState<CatalogMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      setItems(await acquisitionsService.listQueue());
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to load acquisitions.');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);

  useEffect(() => {
    let cancelled = false;
    libraryService.getLocationTree()
      .then((nodes) => { if (!cancelled) setLocationNodes(nodes); })
      .catch((err) => { if (!cancelled) setLocationsError(err instanceof Error ? err.message : 'Failed to load locations.'); })
      .finally(() => { if (!cancelled) setLocationsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const searchMatches = useCallback(async (query: { isbn?: string; title?: string; author?: string }) => {
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      setMatches(await libraryService.searchCatalogMatches(query));
    } catch (err) {
      setMatches([]);
      setMatchesError(err instanceof Error ? err.message : 'Failed to search catalog.');
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const submitIntake = useCallback(async (payload: DonationIntakePayload) => {
    try {
      if (payload.status === 'accepted') {
        if (!payload.location?.branchId) {
          return { success: false, error: 'Select a location before accepting this donation.' };
        }
        const location = await libraryService.validateLocation(payload.location);
        if (!location.valid) return { success: false, error: 'The selected location is no longer available.' };
      }
      const record = await libraryService.submitDonationIntake(payload);
      await refreshQueue();
      return { success: true, reference: record.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit intake.' };
    }
  }, [refreshQueue]);

  return (
    <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donation intake</h1>
          <p className="mt-1 text-sm text-muted-foreground">Match donated books, record an acceptance decision, and create their acquisition record.</p>
        </div>
        <DonationIntakeWorkflow
          matches={matches}
          matchesLoading={matchesLoading}
          matchesError={matchesError}
          locationNodes={locationNodes}
          locationsLoading={locationsLoading}
          locationsError={locationsError}
          canViewDonorDetails={canViewDonorDetails}
          onSearchMatches={searchMatches}
          onSubmit={submitIntake}
        />
        <section aria-labelledby="acquisition-queue-heading" className="space-y-3">
          <div>
            <h2 id="acquisition-queue-heading" className="text-xl font-semibold text-gray-900">Acquisition queue</h2>
            <p className="text-sm text-muted-foreground">Newly accepted donations appear here for accessioning.</p>
          </div>
          <AcquisitionQueue items={items} isLoading={queueLoading} error={queueError} />
        </section>
      </div>
    </LibraryAdminLayout>
  );
}
