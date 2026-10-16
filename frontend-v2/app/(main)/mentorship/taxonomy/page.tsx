'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  ExpertiseTaxonomyBrowser,
  IDENTITY_NAV_ITEMS,
  IdentityPageShell,
  canAccessIdentityArea,
} from '@/src/features/mentorship/identity';

export default function ExpertiseTaxonomyPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessIdentityArea(user?.role, 'taxonomy');

  return (
    <IdentityPageShell
      allowed={allowed}
      title="Mentor expertise taxonomy"
      description="Browse the versioned skill tree. Filters use stable skill ids, aliases normalise before uniqueness is checked, and deprecated skills migrate to a live replacement."
      activeHref="/mentorship/taxonomy"
      navItems={IDENTITY_NAV_ITEMS}
    >
      <ExpertiseTaxonomyBrowser canManage={allowed} />
    </IdentityPageShell>
  );
}
