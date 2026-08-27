'use client';

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
