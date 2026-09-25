'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  AcceptanceDeadlineBanner,
  AwardAgreementForm,
  canAccessScholarshipArea,
  ScholarshipPageShell,
  useScholarshipAwards,
} from '@/src/features/scholarships';
import type { AwardRecord } from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/awards', label: 'Awards' },
  { href: '/scholarships/awards/create', label: 'Create Award' },
  { href: '/scholarships/awards/accept', label: 'Accept Award' },
  { href: '/scholarships/awards/cancel', label: 'Cancellations' },
  { href: '/scholarships/awards/schedule', label: 'Disbursement Schedules' },
];

export default function AcceptAwardPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'apply');

  const awardsQuery = useScholarshipAwards();
  const pendingAwards = allowed
    ? (awardsQuery.data ?? []).filter(
        (a) => a.status === 'pending' && a.studentId === user?.id
      )
    : [];

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Accept Award"
      description="Review your pending award offers and sign the agreement to accept."
      activeHref="/scholarships/awards/accept"
      navItems={NAV_ITEMS}
    >
      {awardsQuery.isLoading && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading awards">
          <div className="h-24 animate-pulse rounded-lg border bg-gray-100" />
          <div className="h-24 animate-pulse rounded-lg border bg-gray-100" />
        </div>
      )}

      {awardsQuery.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Unable to load awards.</p>
          <p className="mt-1 text-sm">
            {awardsQuery.error instanceof Error
              ? awardsQuery.error.message
              : 'Please try again.'}
          </p>
        </div>
      )}

      {!awardsQuery.isLoading && !awardsQuery.isError && pendingAwards.length === 0 && (
        <p className="py-12 text-center text-gray-500" role="status">
          You have no pending award offers at this time.
        </p>
      )}

      {pendingAwards.map((award) => {
        const awardRecord = award as AwardRecord;
        return (
          <div key={award.id} className="space-y-4">
            <AcceptanceDeadlineBanner award={awardRecord} />
            <AwardAgreementForm
              award={awardRecord}
              signerIdentity={user?.id ?? ''}
            />
          </div>
        );
      })}
    </ScholarshipPageShell>
  );
}
