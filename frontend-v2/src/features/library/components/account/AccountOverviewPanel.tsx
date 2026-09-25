'use client';

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAccountSummary } from '../../hooks/usePatronAccount';

export interface AccountOverviewPanelProps {
  patronId?: string;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-2xl font-bold text-gray-900">{value}</dd>
    </div>
  );
}

export function AccountOverviewPanel({ patronId }: AccountOverviewPanelProps) {
  const { data: summary, isLoading, isError, error } = useAccountSummary(patronId);

  if (!patronId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" role="status">
        <Lock className="mx-auto mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="font-medium text-gray-900">Sign in required</p>
        <p className="mt-1 text-sm text-gray-500">
          Your library account overview is available after you sign in.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6" aria-busy="true" aria-label="Loading account summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="h-8 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
        <p className="font-medium">Account summary unavailable</p>
        <p className="mt-1 text-sm">
          {error instanceof Error ? error.message : 'Unable to load your account summary.'}
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center" role="status">
        <p className="text-gray-500">No account summary available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Account Summary</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Active Loans" value={String(summary.activeLoans)} />
        <Metric label="Pending Holds" value={String(summary.pendingHolds)} />
        <Metric label="Total Checkouts" value={String(summary.totalCheckouts)} />
        <Metric label="Outstanding Fines" value={formatCurrency(summary.outstandingFinesCents, summary.currency)} />
      </dl>
    </div>
  );
}