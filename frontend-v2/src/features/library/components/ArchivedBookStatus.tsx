'use client';

import { cn } from '@/lib/utils';
import type { ArchiveStatus } from '../types/archive.types';

export interface ArchivedBookStatusProps {
  status: ArchiveStatus;
  title: string;
  archivedAt?: string;
  archiveReason?: string;
  className?: string;
}

const STATUS_COPY: Record<ArchiveStatus, { label: string; tone: string; description: string }> = {
  active: {
    label: 'Active',
    tone: 'bg-emerald-100 text-emerald-800',
    description: 'Available in catalog discovery.',
  },
  archived: {
    label: 'Archived',
    tone: 'bg-slate-100 text-slate-800',
    description: 'Hidden from patron discovery. Librarians can restore this title.',
  },
};

/** Status badge for archived catalog entries — hidden from normal discovery when archived. */
export function ArchivedBookStatus({
  status,
  title,
  archivedAt,
  archiveReason,
  className,
}: ArchivedBookStatusProps) {
  const { label, tone, description } = STATUS_COPY[status];

  return (
    <div className={cn('rounded-md border p-3 text-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{title}</span>
        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', tone)}>{label}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
      {status === 'archived' && archivedAt && (
        <p className="mt-1 text-xs text-gray-400">
          Archived {new Date(archivedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </p>
      )}
      {archiveReason && (
        <p className="mt-1 text-xs text-gray-500">Reason: {archiveReason}</p>
      )}
    </div>
  );
}
