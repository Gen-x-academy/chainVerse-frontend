'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useAccountHolds } from '../../hooks/usePatronAccount';

export interface ActiveHoldsTabProps {
  patronId?: string;
}

export function ActiveHoldsTab({ patronId }: ActiveHoldsTabProps) {
  const { data: holds, isLoading, isError, error } = useAccountHolds(patronId);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading active holds">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Active holds unavailable</p>
        <p className="mt-1 text-sm">
          {error instanceof Error ? error.message : 'Unable to load your holds.'}
        </p>
      </div>
    );
  }

  const items = holds ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-10 text-center" role="status">
        <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="text-gray-500">No active holds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((hold) => (
        <div
          key={hold.bookId}
          className="rounded-lg border border-gray-200 bg-white p-4"
          data-hold-id={hold.bookId}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-gray-900">{hold.bookTitle}</h3>
              <p className="mt-1 text-sm text-gray-500">
                Position {hold.position} of {hold.totalHolders}
                {hold.estimatedWait ? ` · ~${hold.estimatedWait}` : ''}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hold.status === 'ready'
                  ? 'bg-green-50 text-green-700'
                  : hold.status === 'expired'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
              }`}
            >
              {hold.status === 'ready' ? 'Ready for Pickup' : hold.status === 'expired' ? 'Expired' : 'Waiting'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}