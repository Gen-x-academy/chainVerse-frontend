'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  AwardCancellationForm,
  canAccessScholarshipArea,
  ScholarshipPageShell,
  useScholarshipAwards,
} from '@/src/features/scholarships';
import type { AwardRecord, CancellationAuthority } from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/awards', label: 'Awards' },
  { href: '/scholarships/awards/create', label: 'Create Award' },
  { href: '/scholarships/awards/accept', label: 'Accept Award' },
  { href: '/scholarships/awards/cancel', label: 'Cancellations' },
  { href: '/scholarships/awards/schedule', label: 'Disbursement Schedules' },
];

const AUTHORITY_MAP: Record<string, CancellationAuthority> = {
  administrator: 'administrator',
  finance: 'finance',
  sponsor: 'sponsor',
};

export default function CancelAwardPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'awards');

  const awardsQuery = useScholarshipAwards();
  const activeAwards = allowed
    ? (awardsQuery.data ?? []).filter(
        (a) => a.status === 'pending' || a.status === 'accepted' || a.status === 'disbursed'
      )
    : [];

  const authority: CancellationAuthority =
    AUTHORITY_MAP[user?.role ?? ''] ?? 'administrator';

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Award Cancellations"
      description="Cancel a pending award offer (pre-payment) or terminate a disbursed award (post-payment) with documented reason and authority."
      activeHref="/scholarships/awards/cancel"
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

      {!awardsQuery.isLoading && !awardsQuery.isError && activeAwards.length === 0 && (
        <p className="py-12 text-center text-gray-500" role="status">
          There are no active awards available for cancellation or termination.
        </p>
      )}

      <div className="space-y-8">
        {activeAwards.map((award) => (
          <AwardCancellationForm
            key={award.id}
            award={award as AwardRecord}
            authority={authority}
            authorityId={user?.id ?? ''}
          />
        ))}
      </div>
    </ScholarshipPageShell>
  );
}
