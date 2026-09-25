'use client';

import React from 'react';
import type {
  ScholarshipAward,
  ScholarshipDisbursement,
} from '../types/scholarship.types';
import { ScholarshipStatusBadge } from './ScholarshipStatusBadge';

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export interface AwardsOverviewProps {
  awards: ScholarshipAward[];
  disbursements: ScholarshipDisbursement[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
}

export function AwardsOverview({
  awards,
  disbursements,
  isLoading,
  isError,
  error,
}: AwardsOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading awards and disbursements">
        <div className="h-24 animate-pulse rounded-lg border bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg border bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load awards and disbursements</p>
        <p className="mt-1 text-sm">{error instanceof Error ? error.message : 'Please try again.'}</p>
      </div>
    );
  }

  const totalAwardedCents =
    awards.length > 0
      ? awards.reduce((sum, award) => sum + award.amountCents, 0)
      : 0;

  return (
    <div className="space-y-8">
      <section aria-label="Awards summary">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Awards</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{awards.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total awarded</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCurrency(totalAwardedCents, awards[0]?.currency ?? 'USD')}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Disbursements</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{disbursements.length}</p>
          </div>
        </div>
      </section>

      {awards.length === 0 && disbursements.length === 0 ? (
        <p className="py-12 text-center text-gray-500" role="status">
          No awards or disbursements have been recorded yet.
        </p>
      ) : (
        <>
          {awards.length > 0 && (
            <section aria-label="Awards">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Awards</h2>
              <ul className="space-y-2">
                {awards.map((award) => (
                  <li
                    key={award.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(award.amountCents, award.currency)}
                      </p>
                      <p className="text-xs text-gray-500">Application {award.applicationId}</p>
                    </div>
                    <ScholarshipStatusBadge status={award.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {disbursements.length > 0 && (
            <section aria-label="Disbursements">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Disbursements</h2>
              <ul className="space-y-2">
                {disbursements.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(item.amountCents, item.currency)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Scheduled{' '}
                        <time dateTime={item.scheduledAt}>{item.scheduledAt}</time>
                        {item.failureReason ? ` — ${item.failureReason}` : ''}
                      </p>
                    </div>
                    <ScholarshipStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}