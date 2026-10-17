'use client';

import { ConsentLedger } from '@/src/features/mentorship/consent';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell } from '@/src/features/mentorship/components';

export default function MentorshipConsentPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user;
  return (
    <MentorshipPageShell allowed={allowed} title="Consent Ledger" activeHref="/mentorship/consent" navItems={[{ href: '/mentorship', label: 'Overview' }, { href: '/mentorship/consent', label: 'Consent' }]}>
      {user && <ConsentLedger userId={user.id} />}
    </MentorshipPageShell>
  );
}
