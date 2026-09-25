'use client';

import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipPageShell,
} from '@/src/features/scholarships';
import { ApplicationMergeConsole } from '@/src/features/scholarships/duplicates/components/ApplicationMergeConsole';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/manage', label: 'Manage' },
  { href: '/scholarships/manage/duplicates', label: 'Duplicate Merges' },
];

export default function DuplicateMergesPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'manage');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Duplicate Application Resolution"
      description="Inspect detected duplicate applicant submissions, reconcile records, and execute controlled administrative merges."
      activeHref="/scholarships/manage/duplicates"
      navItems={NAV_ITEMS}
    >
      <ApplicationMergeConsole userRole={user?.role ?? 'administrator'} adminUserId={user?.id ?? 'admin-1'} />
    </ScholarshipPageShell>
  );
}
