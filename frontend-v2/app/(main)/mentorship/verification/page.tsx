'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  IDENTITY_NAV_ITEMS,
  IdentityPageShell,
  MentorVerificationPanel,
  canAccessIdentityArea,
} from '@/src/features/mentorship/identity';

export default function IdentityVerificationPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessIdentityArea(user?.role, 'verification');
  const reviewerRole = user?.role === 'admin' ? 'administrator' : undefined;

  return (
    <IdentityPageShell
      allowed={allowed}
      title="Mentor identity verification"
      description="Submit an opaque evidence reference with consent, then let an authorized moderator or administrator approve or reject it. An expired approval removes eligibility."
      activeHref="/mentorship/verification"
      navItems={IDENTITY_NAV_ITEMS}
    >
      <MentorVerificationPanel
        mentorId={user?.id ?? ''}
        reviewerId={user?.id}
        reviewerRole={reviewerRole}
      />
    </IdentityPageShell>
  );
}
