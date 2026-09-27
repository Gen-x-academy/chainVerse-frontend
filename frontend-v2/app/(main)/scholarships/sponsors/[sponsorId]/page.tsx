'use client';

import React, { use } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { SponsorProfileManager } from '@/src/features/scholarships/sponsors';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/sponsors', label: 'Sponsors' },
  { href: '/scholarships/manage', label: 'Manage' },
];

export interface DynamicSponsorProfilePageProps {
  params: Promise<{ sponsorId: string }> | { sponsorId: string };
}

export default function DynamicSponsorProfilePage({ params }: DynamicSponsorProfilePageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const sponsorId = resolvedParams?.sponsorId || 'sponsor-stellar-impact';

  const user = useAuthStore((state) => state.user);

  return (
    <ScholarshipPageShell
      allowed={true}
      title="Sponsor Organization Profile"
      description="Verified identity, contacts, branding, and compliance credentials."
      activeHref="/scholarships/sponsors"
      navItems={NAV_ITEMS}
    >
      <SponsorProfileManager
        sponsorId={sponsorId}
        currentUser={
          user
            ? {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
              }
            : undefined
        }
      />
    </ScholarshipPageShell>
  );
}
