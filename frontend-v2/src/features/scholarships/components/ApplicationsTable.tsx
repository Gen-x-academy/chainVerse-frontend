'use client';

import React from 'react';
import type { ScholarshipApplication } from '../types/scholarship.types';
import { ScholarshipStatusBadge } from './ScholarshipStatusBadge';

function formatCurrency(cents: number | undefined, currency = 'USD'): string {
  if (cents === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export interface ApplicationsTableProps {
  applications: ScholarshipApplication[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  emptyLabel?: string;
}

export function ApplicationsTable({
  applications,
  isLoading,
  isError,
  error,
  emptyLabel = 'No applications found.',
}: ApplicationsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading applications">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load applications</p>
        <p className="mt-1 text-sm">{error instanceof Error ? error.message : 'Please try again.'}</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500" role="status">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">
              Round
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">
              Requested
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">
              Submitted
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {applications.map((application) => (
            <tr key={application.id}>
              <td className="px-4 py-3 font-medium text-gray-900">{application.roundId}</td>
              <td className="px-4 py-3">
                <ScholarshipStatusBadge status={application.status} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {formatCurrency(application.requestedAmountCents)}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {application.submittedAt ? (
                  <time dateTime={application.submittedAt}>{application.submittedAt}</time>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}