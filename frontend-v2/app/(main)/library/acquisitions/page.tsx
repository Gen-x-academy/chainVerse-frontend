'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AcquisitionQueue } from '@/components/elibrary/AcquisitionQueue';
import { DonationIntakeWorkflow } from '@/components/elibrary/DonationIntakeWorkflow';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import { hasLibrarianPermission, useLibrarianPermissions } from '@/src/features/library/hooks/useLibrarianPermissions';
import { libraryService } from '@/src/features/library/services/library.service';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';
import type { CatalogMatch, DonationIntakePayload, LocationNode } from '@/src/features/library/types/library.types';

/**
 * Acquisitions hub: purchase intake and donation intake both feed the accession
 * queue rendered below. Purchase and ISBN-import entry points live on their own
 * routes and are linked here so neither workflow is dropped.
 */
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Acquisitions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Record purchases and donations, then accession new titles into the catalog.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/library/acquisitions/new"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              New purchase intake
            </Link>
            <Link
              href="/library/acquisitions/import"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Import by ISBN
            </Link>
          </div>
        </div>

        <section aria-labelledby="donation-intake-heading" className="space-y-3">
          <div>
            <h2 id="donation-intake-heading" className="text-xl font-semibold text-gray-900">Donation intake</h2>
            <p className="text-sm text-muted-foreground">Match donated books, record an acceptance decision, and create their acquisition record.</p>
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
        </section>

        <section aria-labelledby="acquisition-queue-heading" className="space-y-3">
          <div>
            <h2 id="acquisition-queue-heading" className="text-xl font-semibold text-gray-900">Acquisition queue</h2>
            <p className="text-sm text-muted-foreground">Newly accepted purchases and donations appear here for accessioning.</p>
          </div>
          <AcquisitionQueue items={items} isLoading={queueLoading} error={queueError} />
        </section>
      </div>
    </LibraryAdminLayout>
  );
}
