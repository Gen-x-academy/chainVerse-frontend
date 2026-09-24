'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipPageShell,
} from '@/src/features/scholarships';
import { ApplicationsTable, useScholarshipApplications } from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/applications', label: 'Applications' },
];

export default function ScholarshipsApplicationsPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'applications');

  // Reviewers, finance, and administrators see the full queue. Role scoping is
  // enforced by the API regardless of what the client requests (ADR-001).
  const applicationsQuery = useScholarshipApplications(undefined, { enabled: allowed });

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Scholarship Applications"
      description="Review and manage submitted applications."
      activeHref="/scholarships/applications"
      navItems={NAV_ITEMS}
    >
      <ApplicationsTable
        applications={applicationsQuery.data ?? []}
        isLoading={applicationsQuery.isLoading && allowed}
        isError={applicationsQuery.isError && allowed}
        error={applicationsQuery.error as Error | null}
        emptyLabel="No applications in the review queue."
      />
    </ScholarshipPageShell>
  );
}