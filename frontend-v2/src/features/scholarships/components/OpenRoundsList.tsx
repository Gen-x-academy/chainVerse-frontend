'use client';

import React from 'react';
import Link from 'next/link';
import type { ScholarshipRound } from '../types/scholarship.types';
import { ScholarshipStatusBadge } from './ScholarshipStatusBadge';

function formatCurrency(cents: number | undefined, currency: string): string {
  if (cents === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export interface RoundsListProps {
  rounds: ScholarshipRound[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
}

export function OpenRoundsList({ rounds, isLoading, isError, error }: RoundsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading scholarship rounds">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load scholarship rounds</p>
        <p className="mt-1 text-sm">{error instanceof Error ? error.message : 'Please try again.'}</p>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500" role="status">
        There are no open scholarship rounds right now.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rounds.map((round) => (
        <li key={round.id} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">{round.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Closes <time dateTime={round.applicationDeadline}>{round.applicationDeadline}</time>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Award up to {formatCurrency(round.awardAmountCents, round.currency)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <ScholarshipStatusBadge status={round.status} />
              <Link
                href={`/scholarships/apply?round=${round.id}`}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Apply
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}