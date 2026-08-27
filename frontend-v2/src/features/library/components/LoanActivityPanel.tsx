'use client';

import React from 'react';
import { LoanTimeline } from './LoanTimeline';
import { useLoanActivity } from '../hooks/useLoanActivity';
import { useAuthStore } from '@/src/store/authStore';

export interface LoanActivityPanelProps {
  /** Librarians may pass a patron id; patrons see their own activity. */
  patronId?: string;
}

export function LoanActivityPanel({ patronId }: LoanActivityPanelProps) {
  const user = useAuthStore((s) => s.user);
  const isSelf = !patronId || patronId === user?.id;
  const { data, isLoading, isError, error } = useLoanActivity(isSelf ? undefined : patronId);

  const errorMessage =
    isError && error instanceof Error
      ? error.message
      : isError
        ? 'Failed to load activity'
        : null;

  return (
    <section aria-labelledby="loan-activity-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="loan-activity-heading" className="text-lg font-semibold text-gray-900">
          Loan Activity
        </h2>
        <span className="text-xs text-gray-400">History cannot be edited</span>
      </div>
      <LoanTimeline
        events={data?.data ?? []}
        isLoading={isLoading}
        error={errorMessage}
        readOnly
      />
    </section>
  );
}
