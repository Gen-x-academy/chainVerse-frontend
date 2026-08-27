'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { AcquisitionQueue } from '@/components/elibrary/AcquisitionQueue';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';

/** #930: Acquisitions queue listing */
export default function AcquisitionsPage() {
  const [items, setItems] = useState<AcquisitionQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    acquisitionsService.listQueue()
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Acquisitions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Purchase intake and accession queue.
            </p>
          </div>
          <Link
            href="/library/acquisitions/new"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New purchase intake
          </Link>
        </div>
        <AcquisitionQueue items={items} isLoading={isLoading} error={error} />
      </div>
    </LibraryAdminLayout>
import React, { useCallback, useState } from 'react';
import { DonationIntakeWorkflow } from '@/components/elibrary/DonationIntakeWorkflow';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import {
  MOCK_LOCATION_TREE,
  mockSearchCatalogMatches,
} from '@/src/features/library/utils/mockLibraryData';
import type { CatalogMatch } from '@/src/features/library/types/library.types';

export default function AcquisitionsPage() {
  const [matches, setMatches] = useState<CatalogMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const handleSearchMatches = useCallback((query: { isbn?: string; title?: string; author?: string }) => {
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      const results = mockSearchCatalogMatches(query);
      setMatches(results);
      if (results.length === 0) setMatches([]);
    } catch {
      setMatchesError('Failed to search catalog.');
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (payload: Parameters<NonNullable<React.ComponentProps<typeof DonationIntakeWorkflow>['onSubmit']>>[0]) => {
      await new Promise((r) => setTimeout(r, 300));
      if (payload.status === 'rejected' && !payload.rejectionReason?.trim()) {
        return { success: false, error: 'Rejection reason required' };
      }
      return { success: true };
    },
    []
  );

  return (
    <LibrarianLayout
      permissions={['acquisitions', 'catalog']}
      activeHref="/library/acquisitions"
      title="Acquisitions — Donation intake"
    >
      <DonationIntakeWorkflow
        canViewDonorDetails
        locationNodes={MOCK_LOCATION_TREE}
        matches={matches}
        matchesLoading={matchesLoading}
        matchesError={matchesError}
        onSearchMatches={handleSearchMatches}
        onSubmit={handleSubmit}
      />
    </LibrarianLayout>
  );
}
