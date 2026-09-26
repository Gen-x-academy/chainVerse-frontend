'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipFeatureFlagsPanel } from '@/src/features/scholarships/flags/components/ScholarshipFeatureFlagsPanel';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/flags', label: 'Feature flags' },
  { href: '/scholarships/concurrency', label: 'Concurrency' },
  { href: '/scholarships/retention', label: 'Retention' },
  { href: '/scholarships/abuse', label: 'Abuse controls' },
];

/** Administrators and the non-admin finance role both operate rollouts. */
const ALLOWED_ROLES = ['administrator', 'finance'];

export default function ScholarshipFlagsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = typeof role === 'string' && ALLOWED_ROLES.includes(role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Feature flags & staged rollout"
      description="Release each scholarship surface to an allowlist, then a percentage of the cohort, then everyone — per environment, failing closed if the flag service is unreachable."
      activeHref="/scholarships/flags"
      navItems={NAV_ITEMS}
    >
      <ScholarshipFeatureFlagsPanel canManage={allowed} />
    </ScholarshipPageShell>
  );
}
