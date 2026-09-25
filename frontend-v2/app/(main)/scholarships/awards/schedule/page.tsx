'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipPageShell,
  useScholarshipAwards,
  useDisbursementSchedule,
} from '@/src/features/scholarships';
import { DisbursementScheduleBuilder } from '@/src/features/scholarships/milestones/components';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/awards', label: 'Awards' },
  { href: '/scholarships/awards/create', label: 'Create Award' },
  { href: '/scholarships/awards/accept', label: 'Accept Award' },
  { href: '/scholarships/awards/cancel', label: 'Cancellations' },
  { href: '/scholarships/awards/schedule', label: 'Disbursement Schedules' },
];

function AwardScheduleEntry({ awardId, awardAmountCents, currency }: {
  awardId: string;
  awardAmountCents: number;
  currency: string;
}) {
  const scheduleQuery = useDisbursementSchedule(awardId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
      <p className="text-sm font-medium text-slate-700">
        Award <span className="font-mono text-xs text-slate-500">{awardId}</span>
      </p>

      {scheduleQuery.isLoading && (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" aria-busy="true" />
      )}

      {scheduleQuery.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Unable to load schedule. Please refresh.
        </div>
      )}

      {!scheduleQuery.isLoading && (
        <DisbursementScheduleBuilder
          awardId={awardId}
          awardAmountCents={awardAmountCents}
          currency={currency}
          existingSchedule={scheduleQuery.data}
        />
      )}
    </div>
  );
}

export default function DisbursementSchedulePage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'awards');

  const awardsQuery = useScholarshipAwards();
  const acceptedAwards = allowed
    ? (awardsQuery.data ?? []).filter((a) => a.status === 'accepted')
    : [];

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Disbursement Schedules"
      description="Define milestone-based disbursement schedules for accepted awards. Percentages must total 100% and dates must be in ascending order."
      activeHref="/scholarships/awards/schedule"
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

      {!awardsQuery.isLoading && !awardsQuery.isError && acceptedAwards.length === 0 && (
        <p className="py-12 text-center text-gray-500" role="status">
          No accepted awards are available for scheduling yet.
        </p>
      )}

      <div className="space-y-8">
        {acceptedAwards.map((award) => (
          <AwardScheduleEntry
            key={award.id}
            awardId={award.id}
            awardAmountCents={award.amountCents}
            currency={award.currency}
          />
        ))}
      </div>
    </ScholarshipPageShell>
  );
}
