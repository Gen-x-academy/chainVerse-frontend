'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import { MentorAvailabilityPanel } from '@/src/features/mentorship/availability';

const NAV_ITEMS = [
  { href: '/mentorship/availability', label: 'Mentor availability' },
];

export default function MentorAvailabilityPage() {
  const user = useAuthStore((state) => state.user);
  // The auth store carries the legacy `admin | instructor | student` roles;
  // map them onto the mentorship vocabulary before the area check.
  const allowed = canAccessMentorshipArea(toIdentityRole(user?.role), 'availability');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Mentor availability"
      description="Schedule when mentors accept requests, limit their availability, or go on standby."
      activeHref="/mentorship/availability"
      navItems={NAV_ITEMS}
    >
      <MentorAvailabilityPanel />
    </MentorshipPageShell>
  );
}
