'use client';

import { DataExport } from '@/src/features/mentorship/data-export';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell } from '@/src/features/mentorship/components';

export default function MentorshipExportPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user;
  return (
    <MentorshipPageShell allowed={allowed} title="Data Export" activeHref="/mentorship/data-export" navItems={[{ href: '/mentorship', label: 'Overview' }, { href: '/mentorship/data-export', label: 'Export' }]}>
      {user && <DataExport userId={user.id} />}
    </MentorshipPageShell>
  );
}
