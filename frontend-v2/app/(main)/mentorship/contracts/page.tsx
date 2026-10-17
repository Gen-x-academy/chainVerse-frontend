'use client';

import { FileCode2 } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell, canAccessMentorshipArea } from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import {
  MENTORSHIP_CONTRACTS_VERSION,
  MENTORSHIP_CONTRACT_REGISTRY,
  MENTORSHIP_MAX_PAGE_SIZE,
  MENTORSHIP_DEFAULT_PAGE_SIZE,
} from '@/src/features/mentorship/contracts';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
  { href: '/mentorship/contracts', label: 'Versioned contracts' },
];

/**
 * Read-only view of the MENTOR-006 contract registry: which contracts exist,
 * which versions are supported or deprecated, and the primitive bounds every
 * payload must respect.
 */
export default function MentorshipContractsPage() {
  const user = useAuthStore((state) => state.user);
  // Legacy auth-store vocabulary mapped onto the mentorship roles first.
  const role = toIdentityRole(user?.role);
  const allowed = canAccessMentorshipArea(role, 'contracts');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Versioned contracts"
      description={`Envelope model v${MENTORSHIP_CONTRACTS_VERSION}: every command, query, and event declares the schema version it was written against.`}
      activeHref="/mentorship/contracts"
      navItems={NAV_ITEMS}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-2">
          <FileCode2 className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">Contract registry</h2>
        </header>
        <ul className="mt-4 space-y-4">
          {MENTORSHIP_CONTRACT_REGISTRY.map((entry) => (
            <li key={entry.contract} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium text-slate-900">{entry.contract}</p>
                  <p className="mt-1 text-xs text-slate-500">{entry.compatibility}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>
                    Latest <span className="font-semibold">{entry.latestVersion}</span>
                  </p>
                  <p>
                    Supported {entry.supportedVersions.join(', ')}
                  </p>
                  <p>
                    Deprecated {entry.deprecatedVersions.length > 0 ? entry.deprecatedVersions.join(', ') : 'none'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Primitive bounds</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-sm font-semibold text-slate-800">Money</dt>
            <dd className="mt-1 text-xs text-slate-600">
              Integer minor units only (never a float), currency XLM or USDC.
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-sm font-semibold text-slate-800">Pagination</dt>
            <dd className="mt-1 text-xs text-slate-600">
              page {'>'}= 1; pageSize 1..{MENTORSHIP_MAX_PAGE_SIZE} (default{' '}
              {MENTORSHIP_DEFAULT_PAGE_SIZE}).
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-sm font-semibold text-slate-800">Windows and dates</dt>
            <dd className="mt-1 text-xs text-slate-600">
              ISO 8601; endsAt is optional and must be strictly after startsAt.
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-sm font-semibold text-slate-800">Nullable vs omitted</dt>
            <dd className="mt-1 text-xs text-slate-600">
              A T | null field is known to be empty; an optional field is not
              sent. Nothing else is valid.
            </dd>
          </div>
        </dl>
      </section>
    </MentorshipPageShell>
  );
}
