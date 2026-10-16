'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  IDENTITY_NAV_ITEMS,
  IdentityPageShell,
  MenteeLearningProfileForm,
  canAccessIdentityArea,
} from '@/src/features/mentorship/identity';

export default function LearningProfilePage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessIdentityArea(user?.role, 'learning-profile');

  return (
    <IdentityPageShell
      allowed={allowed}
      title="Mentee learning profile"
      description="Set your learning goals, level, interests, and preferences. Track completeness, and keep sensitive accessibility and matching details private to authorized matching."
      activeHref="/mentorship/learning-profile"
      navItems={IDENTITY_NAV_ITEMS}
    >
      <MenteeLearningProfileForm menteeId={user?.id ?? ''} canEdit={allowed} />
    </IdentityPageShell>
  );
}
