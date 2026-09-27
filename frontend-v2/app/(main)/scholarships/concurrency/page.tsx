'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipConcurrencyPanel } from '@/src/features/scholarships/concurrency/components/ScholarshipConcurrencyPanel';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/flags', label: 'Feature flags' },
  { href: '/scholarships/concurrency', label: 'Concurrency' },
  { href: '/scholarships/retention', label: 'Retention' },
  { href: '/scholarships/abuse', label: 'Abuse controls' },
];

/** Administrators and the non-admin finance role both write versioned resources. */
const ALLOWED_ROLES = ['administrator', 'finance'];

export default function ScholarshipConcurrencyPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = typeof role === 'string' && ALLOWED_ROLES.includes(role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Optimistic concurrency"
      description="Writes are applied only against the version the editor loaded. A stale write is rejected whole, with a field-by-field review instead of a silent overwrite."
      activeHref="/scholarships/concurrency"
      navItems={NAV_ITEMS}
    >
      <ScholarshipConcurrencyPanel canManage={allowed} />
    </ScholarshipPageShell>
  );
}
