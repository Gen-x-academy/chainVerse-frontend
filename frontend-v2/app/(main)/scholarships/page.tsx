'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipHub,
  ScholarshipPageShell,
} from '@/src/features/scholarships';

const NAV_ITEMS = [{ href: '/scholarships', label: 'Overview' }];

export default function ScholarshipsHubPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'hub');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Scholarships"
      description="Explore scholarships and sponsorship programs available to you."
      activeHref="/scholarships"
      navItems={NAV_ITEMS}
    >
      <ScholarshipHub />
    </ScholarshipPageShell>
  );
}
