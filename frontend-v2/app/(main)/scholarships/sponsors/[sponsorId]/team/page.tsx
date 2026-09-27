'use client';

import React, { use } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { canAccessScholarshipArea } from '@/src/features/scholarships/utils/scholarshipRoles';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { SponsorTeamManager } from '@/src/features/scholarships/sponsors';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/manage', label: 'Manage' },
  { href: '/scholarships/sponsors/team', label: 'Sponsor Team' },
];

export interface DynamicSponsorTeamPageProps {
  params: Promise<{ sponsorId: string }> | { sponsorId: string };
}

export default function DynamicSponsorTeamPage({ params }: DynamicSponsorTeamPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const sponsorId = resolvedParams?.sponsorId || 'sponsor-stellar-impact';

  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? 'owner';
  const allowed = !user || canAccessScholarshipArea(user.role, 'sponsor-team');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Sponsor Team Management"
      description="Manage team memberships, role boundaries, and invitations for your sponsor organization."
      activeHref="/scholarships/sponsors/team"
      navItems={NAV_ITEMS}
    >
      <SponsorTeamManager
        sponsorId={sponsorId}
        sponsorName={`Sponsor ${sponsorId}`}
        currentUserRole={userRole}
      />
    </ScholarshipPageShell>
  );
}
