'use client';

import { useAuthStore } from '@/src/store/authStore';
import { getStagingToolingAvailability } from '../utils/stagingEnvironment';
import { ScholarshipsNav } from '../components/ScholarshipsNav';
import { ScholarshipPageShell } from '../components/ScholarshipPageShell';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/staging', label: 'Staging & testnet seed' },
];

/**
 * Synthetic seed runs are load-equivalent, so the page is gated twice (#1220):
 * an explicit build-time opt-in and a non-production API origin. See
 * `docs/scholarships-load-testing.md`.
 */
export function StagingPage() {
  const user = useAuthStore((state) => state.user);
  const tooling = getStagingToolingAvailability();
  const allowed = canAccessScholarshipArea(user?.role, 'manage') && tooling.available;

  return (
    <>
      <ScholarshipsNav />
      <ScholarshipPageShell
        allowed={allowed}
        title="Staging & testnet"
        description="Deterministic synthetic seed runs for staging and testnet with rollback manifests and one-call revoke."
        activeHref="/scholarships/staging"
        navItems={NAV_ITEMS}
      >
        {tooling.available ? (
          <StagingSeedFlow />
        ) : (
          <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Tooling not enabled in this build</h2>
            <p className="mt-2 text-sm text-slate-600">{tooling.reason}</p>
          </div>
        )}
      </ScholarshipPageShell>
    </>
  );
}

export default StagingPage;