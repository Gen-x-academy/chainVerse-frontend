'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipPageShell,
  useScholarshipRounds,
} from '@/src/features/scholarships';
import { AtomicSubmissionFlow } from '@/src/features/scholarships/applications/components/AtomicSubmissionFlow';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/apply', label: 'Apply' },
  { href: '/scholarships/apply/atomic', label: 'Atomic Submission' },
];

export default function AtomicApplicationPage() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const roundIdParam = searchParams.get('round');

  const { data: rounds, isLoading, isError, error } = useScholarshipRounds();
  const openRounds = (rounds ?? []).filter((r) => r.status === 'open');

  const selectedRound =
    openRounds.find((r) => r.id === roundIdParam) ?? openRounds[0] ?? null;

  const allowed = canAccessScholarshipArea(user?.role, 'apply');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Atomic Scholarship Application"
      description="Validate eligibility, completeness, documents, consent, deadline, and uniqueness in one atomic transition."
      activeHref="/scholarships/apply/atomic"
      navItems={NAV_ITEMS}
    >
      {isLoading && (
        <div role="status" aria-busy="true" className="space-y-4">
          <p className="sr-only">Loading scholarship round details…</p>
          <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <p className="font-bold">Failed to load scholarship round information</p>
          <p className="mt-1 text-xs">
            {error instanceof Error ? error.message : 'Please check your connection and refresh.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && selectedRound && (
        <AtomicSubmissionFlow
          round={selectedRound}
          studentId={user?.id ?? 'student-applicant-1'}
          userRole={user?.role ?? 'student'}
        />
      )}

      {!isLoading && !isError && !selectedRound && (
        <div role="status" className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <h2 className="text-lg font-bold text-slate-900">No Open Scholarship Rounds Available</h2>
          <p className="mt-1 text-xs text-slate-500">
            There are currently no active open rounds taking submissions. Please check back later.
          </p>
        </div>
      )}
    </ScholarshipPageShell>
  );
}
