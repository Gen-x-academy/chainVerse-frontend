'use client';

import Link from 'next/link';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';

interface AcquisitionQueueProps {
  items: AcquisitionQueueItem[];
  isLoading?: boolean;
  error?: string | null;
}

const STATUS_LABEL: Record<AcquisitionQueueItem['status'], string> = {
  pending: 'Pending accession',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const SOURCE_LABEL: Record<AcquisitionQueueItem['source'], string> = {
  vendor: 'Vendor',
  donation: 'Donation',
  exchange: 'Exchange',
  'internal-transfer': 'Internal',
};

/** #930: Acquisition queue listing pending accessions */
export function AcquisitionQueue({ items, isLoading, error }: AcquisitionQueueProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading acquisition queue" className="py-8 text-center text-sm text-muted-foreground">
        Loading acquisitions…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No acquisitions in queue. Create a new purchase intake to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4 hidden sm:table-cell">Author</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4 hidden md:table-cell">Received</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-3 pr-4 font-medium">{item.title}</td>
              <td className="py-3 pr-4 hidden sm:table-cell">{item.author}</td>
              <td className="py-3 pr-4">{SOURCE_LABEL[item.source]}</td>
              <td className="py-3 pr-4 hidden md:table-cell">{item.receivedDate}</td>
              <td className="py-3 pr-4">{STATUS_LABEL[item.status]}</td>
              <td className="py-3">
                {item.status !== 'completed' && item.status !== 'cancelled' ? (
                  <Link
                    href={`/library/acquisitions/${item.id}/accession`}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    Accession
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
