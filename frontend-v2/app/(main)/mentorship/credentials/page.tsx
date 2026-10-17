'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import { CredentialClaimsPanel } from '@/src/features/mentorship/credentials';

const NAV_ITEMS = [
  { href: '/mentorship/credentials', label: 'Credential verification' },
];

export default function CredentialVerificationPage() {
  const user = useAuthStore((state) => state.user);
  // The auth store carries the legacy `admin | instructor | student` roles;
  // map them onto the mentorship vocabulary before the area check.
  const allowed = canAccessMentorshipArea(toIdentityRole(user?.role), 'credentials');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Credential verification"
      description="Review submitted mentor credentials and keep an audit trail of every decision."
      activeHref="/mentorship/credentials"
      navItems={NAV_ITEMS}
    >
      <CredentialClaimsPanel />
    </MentorshipPageShell>
  );
}
