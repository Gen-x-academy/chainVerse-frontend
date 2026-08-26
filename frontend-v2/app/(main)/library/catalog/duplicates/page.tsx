'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { DuplicateCandidateList } from '@/components/elibrary/DuplicateCandidateList';
import { catalogMergeService } from '@/src/features/library/services/catalog-merge.service';
import type { DuplicateCandidate } from '@/src/features/library/types/catalog.types';

/** #927: Duplicate candidate listing */
export default function DuplicatesPage() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalogMergeService.listDuplicates()
      .then((data) => { if (!cancelled) setCandidates(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-6">
        <div>
          <Link href="/library/catalog" className="text-sm text-indigo-600 hover:underline">
            ← Catalog admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Suspected duplicates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and merge duplicate catalog records side by side.
          </p>
        </div>
        <DuplicateCandidateList candidates={candidates} isLoading={isLoading} error={error} />
      </div>
    </LibraryAdminLayout>
  );
}
