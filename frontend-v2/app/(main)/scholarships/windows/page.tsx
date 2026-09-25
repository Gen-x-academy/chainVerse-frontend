'use client';

import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ProgramDeadlineManager } from '@/src/features/scholarships/windows/components/ProgramDeadlineManager';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/scopes', label: 'Program Scopes' },
  { href: '/scholarships/windows', label: 'Deadline Windows' },
  { href: '/scholarships/manage', label: 'Manage' },
];

export default function ProgramWindowsPage() {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? 'administrator';

  return (
    <ScholarshipPageShell
      allowed={true}
      title="Application Opening & Deadline Windows"
      description="Configure deterministic opening, closing, explicit timezones, grace periods, and late-submission rules."
      activeHref="/scholarships/windows"
      navItems={NAV_ITEMS}
    >
      <ProgramDeadlineManager userRole={userRole} />
    </ScholarshipPageShell>
  );
}
