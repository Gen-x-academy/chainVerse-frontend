'use client';

import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipApplyForm,
  ScholarshipPageShell,
} from '@/src/features/scholarships';
import { OpenRoundsList, useScholarshipRounds } from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/apply', label: 'Apply' },
];

export default function ScholarshipsApplyPage() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const preselectedRound = searchParams.get('round') ?? undefined;

  const { data, isLoading, isError, error } = useScholarshipRounds();
  const openRounds = (data ?? []).filter((round) => round.status === 'open');

  const allowed = canAccessScholarshipArea(user?.role, 'apply');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Apply for Scholarships"
      description="Browse open rounds and submit your application."
      activeHref="/scholarships/apply"
      navItems={NAV_ITEMS}
    >
      <div className="space-y-8">
        <OpenRoundsList
          rounds={openRounds}
          isLoading={isLoading}
          isError={isError}
          error={error}
        />
        {openRounds.length > 0 && (
          <ScholarshipApplyForm
            key={preselectedRound ?? openRounds[0]?.id}
            roundId={preselectedRound ?? openRounds[0]?.id ?? ''}
          />
        )}
      </div>
    </ScholarshipPageShell>
  );
}