'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipRetentionPanel } from '@/src/features/scholarships/retention/components/ScholarshipRetentionPanel';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/flags', label: 'Feature flags' },
  { href: '/scholarships/concurrency', label: 'Concurrency' },
  { href: '/scholarships/retention', label: 'Retention' },
  { href: '/scholarships/abuse', label: 'Abuse controls' },
];

/** Administrators and the non-admin finance role both handle financial retention. */
const ALLOWED_ROLES = ['administrator', 'finance'];

export default function ScholarshipRetentionPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = typeof role === 'string' && ALLOWED_ROLES.includes(role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Retention & erasure"
      description="Retention rules per record class with a stated legal basis, legal holds that override everything, and an erasure preview that never breaks financial or audit integrity."
      activeHref="/scholarships/retention"
      navItems={NAV_ITEMS}
    >
      <ScholarshipRetentionPanel canManage={allowed} />
    </ScholarshipPageShell>
  );
}
