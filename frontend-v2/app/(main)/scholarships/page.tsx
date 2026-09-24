'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipHub } from '@/src/features/scholarships';
import { ScholarshipPageShell } from '@/src/features/scholarships';

const NAV_ITEMS = [{ href: '/scholarships', label: 'Overview' }];

export default function ScholarshipsPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const allowed = isAuthenticated && Boolean(user);

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