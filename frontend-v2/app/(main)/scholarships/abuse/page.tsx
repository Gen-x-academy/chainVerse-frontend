'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipAbuseControlsPanel } from '@/src/features/scholarships/abuse/components/ScholarshipAbuseControlsPanel';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/flags', label: 'Feature flags' },
  { href: '/scholarships/concurrency', label: 'Concurrency' },
  { href: '/scholarships/retention', label: 'Retention' },
  { href: '/scholarships/abuse', label: 'Abuse controls' },
];

/** Administrators and the non-admin finance role both oversee abuse controls. */
const ALLOWED_ROLES = ['administrator', 'finance'];

export default function ScholarshipAbusePage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = typeof role === 'string' && ALLOWED_ROLES.includes(role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Rate & abuse controls"
      description="Per-surface, per-tier limits with explicit retry guidance, a bypass that needs a service authorization id, and a guarantee that a throttled request never truncates a saved draft."
      activeHref="/scholarships/abuse"
      navItems={NAV_ITEMS}
    >
      <ScholarshipAbuseControlsPanel canManage={allowed} />
    </ScholarshipPageShell>
  );
}
