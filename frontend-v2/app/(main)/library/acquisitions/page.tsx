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
  );
}
