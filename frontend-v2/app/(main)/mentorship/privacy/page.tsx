'use client';

import { PrivacyControls } from '@/src/features/mentorship/privacy';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell } from '@/src/features/mentorship/components';

export default function MentorshipPrivacyPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user;
  return (
    <MentorshipPageShell allowed={allowed} title="Privacy Controls" activeHref="/mentorship/privacy" navItems={[{ href: '/mentorship', label: 'Overview' }, { href: '/mentorship/privacy', label: 'Privacy' }]}>
      {user && <PrivacyControls userId={user.id} />}
    </MentorshipPageShell>
  );
}
