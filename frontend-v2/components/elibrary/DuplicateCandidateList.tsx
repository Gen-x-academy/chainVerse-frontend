'use client';

import Link from 'next/link';
import type { DuplicateCandidate } from '@/src/features/library/types/catalog.types';

interface DuplicateCandidateListProps {
  candidates: DuplicateCandidate[];
  isLoading?: boolean;
  error?: string | null;
}

/** #927: List of suspected duplicate catalog groups */
export function DuplicateCandidateList({
  candidates,
  isLoading,
  error,
}: DuplicateCandidateListProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading duplicate candidates" className="py-8 text-center text-sm text-muted-foreground">
        Loading suspected duplicates…
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

  if (candidates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No suspected duplicate records found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">Records</th>
            <th className="py-2 pr-4">Match score</th>
            <th className="py-2 pr-4 hidden sm:table-cell">Holdings</th>
            <th className="py-2 pr-4 hidden md:table-cell">Active loans</th>
            <th className="py-2 pr-4 hidden md:table-cell">Pending holds</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((group) => (
            <tr key={group.groupId} className="border-b">
              <td className="py-3 pr-4">
                <ul className="space-y-1">
                  {group.records.map((r) => (
                    <li key={r.id} className="font-medium">{r.title}</li>
                  ))}
                </ul>
              </td>
              <td className="py-3 pr-4">{Math.round(group.matchScore * 100)}%</td>
              <td className="py-3 pr-4 hidden sm:table-cell">{group.holdingsCount}</td>
              <td className="py-3 pr-4 hidden md:table-cell">{group.activeLoansCount}</td>
              <td className="py-3 pr-4 hidden md:table-cell">{group.pendingHoldsCount}</td>
              <td className="py-3">
                <Link
                  href={`/library/catalog/duplicates/${group.groupId}`}
                  className="text-indigo-600 hover:underline text-sm font-medium"
                >
                  Compare &amp; merge
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
