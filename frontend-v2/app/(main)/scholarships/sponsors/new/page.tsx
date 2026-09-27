'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { CreateSponsorOrgForm, useSponsorOrgStore } from '@/src/features/scholarships/sponsors';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/sponsors', label: 'Sponsors' },
  { href: '/scholarships/sponsors/new', label: 'Register Organization' },
];

export default function NewSponsorOrganizationPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { createOrganization, isMutating } = useSponsorOrgStore();

  const tenantId = user?.tenantId || 'tenant-current-workspace';
  const userEmail = user?.email || 'admin@chainverse.org';

  return (
    <ScholarshipPageShell
      allowed={true}
      title="Register Sponsor Organization"
      description="Create a tenant-scoped funding organization with verified identity, branding, and compliance credentials."
      activeHref="/scholarships/sponsors/new"
      navItems={NAV_ITEMS}
    >
      <CreateSponsorOrgForm
        tenantId={tenantId}
        userEmail={userEmail}
        isSubmitting={isMutating}
        onSubmit={async (payload) => {
          const org = await createOrganization(payload, {
            userId: user?.id || 'user-admin',
            userEmail,
            tenantId,
            role: user?.role || 'owner',
          });
          if (org) {
            router.push(`/scholarships/sponsors/${org.id}`);
            return true;
          }
          return false;
        }}
      />
    </ScholarshipPageShell>
  );
}
