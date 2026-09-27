'use client';

import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { SponsorOrganizationDirectory } from '@/src/features/scholarships/sponsors';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/sponsors', label: 'Sponsors' },
  { href: '/scholarships/manage', label: 'Manage' },
];

export default function SponsorsDirectoryPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <ScholarshipPageShell
      allowed={true}
      title="Sponsor Organizations"
      description="Browse verified funding organizations, compliance certifications, and institutional sponsors."
      activeHref="/scholarships/sponsors"
      navItems={NAV_ITEMS}
    >
      <SponsorOrganizationDirectory
        currentUser={{
          userId: user?.id,
          role: user?.role,
          tenantId: user?.tenantId,
        }}
      />
    </ScholarshipPageShell>
  );
}
