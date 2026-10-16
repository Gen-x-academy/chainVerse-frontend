'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  IDENTITY_NAV_ITEMS,
  IdentityPageShell,
  MentorProfileEditor,
  canAccessIdentityArea,
} from '@/src/features/mentorship/identity';

export default function MentorProfilePage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessIdentityArea(user?.role, 'mentor-profile');

  return (
    <IdentityPageShell
      allowed={allowed}
      title="Mentor professional profile"
      description="Author a headline, biography, expertise, languages, and teaching approach, then draft privately and publish when every required field validates."
      activeHref="/mentorship/mentor-profile"
      navItems={IDENTITY_NAV_ITEMS}
    >
      <MentorProfileEditor mentorId={user?.id ?? ''} canEdit={allowed} />
    </IdentityPageShell>
  );
}
