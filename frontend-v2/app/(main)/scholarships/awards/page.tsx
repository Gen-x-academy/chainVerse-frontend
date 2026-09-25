'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  AwardsOverview,
  canAccessScholarshipArea,
  ScholarshipPageShell,
} from '@/src/features/scholarships';
import {
  useScholarshipAwards,
  useScholarshipDisbursements,
} from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/awards', label: 'Awards & Disbursements' },
];

export default function ScholarshipsAwardsPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'awards');

  const awardsQuery = useScholarshipAwards({ enabled: allowed });
  const disbursementsQuery = useScholarshipDisbursements({ enabled: allowed });

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Awards & Disbursements"
      description="Track granted awards and their disbursement status."
      activeHref="/scholarships/awards"
      navItems={NAV_ITEMS}
    >
      <AwardsOverview
        awards={allowed ? (awardsQuery.data ?? []) : []}
        disbursements={allowed ? (disbursementsQuery.data ?? []) : []}
        isLoading={allowed && (awardsQuery.isLoading || disbursementsQuery.isLoading)}
        isError={allowed && (awardsQuery.isError || disbursementsQuery.isError)}
        error={awardsQuery.error ?? disbursementsQuery.error}
      />
    </ScholarshipPageShell>
  );
}