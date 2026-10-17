'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import { TrustIndicatorsPanel } from '@/src/features/mentorship/trust';

const NAV_ITEMS = [
  { href: '/mentorship/trust', label: 'Trust indicators' },
];

export default function TrustIndicatorsPage() {
  const user = useAuthStore((state) => state.user);
  // The auth store carries the legacy `admin | instructor | student` roles;
  // map them onto the mentorship vocabulary before the area check.
  const allowed = canAccessMentorshipArea(toIdentityRole(user?.role), 'trust');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Trust indicators"
      description="Explainable completion, verification, response, delivery, and safety indicators."
      activeHref="/mentorship/trust"
      navItems={NAV_ITEMS}
    >
      <TrustIndicatorsPanel />
    </MentorshipPageShell>
  );
}
