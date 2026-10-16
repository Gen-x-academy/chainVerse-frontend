'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipCapabilityConfigPanel,
  MentorshipPageShell,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
];

export default function MentorshipConfigPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = canAccessMentorshipArea(role, 'config');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Mentorship capability configuration"
      description="Environment-aware feature flags, limits, supported currencies, session durations, cancellation windows, and evidence rules — validated at startup, with safe defaults."
      activeHref="/mentorship/config"
      navItems={NAV_ITEMS}
    >
      <MentorshipCapabilityConfigPanel canManage={allowed} />
    </MentorshipPageShell>
  );
}
