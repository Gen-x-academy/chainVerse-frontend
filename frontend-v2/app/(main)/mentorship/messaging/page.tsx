'use client';

import { EngagementMessages } from '@/src/features/mentorship/messaging';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell } from '@/src/features/mentorship/components';

export default function MentorshipMessagingPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user;
  const engagementId = 'engagement-1';
  return (
    <MentorshipPageShell allowed={allowed} title="Engagement Messaging" activeHref="/mentorship/messaging" navItems={[{ href: '/mentorship', label: 'Overview' }, { href: '/mentorship/messaging', label: 'Messaging' }]}>
      {user && <EngagementMessages engagementId={engagementId} currentUserId={user.id} />}
    </MentorshipPageShell>
  );
}
