'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell, canAccessMentorshipArea } from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import {
  MENTORSHIP_SEED_VERSION,
  buildMentorshipSeedDataset,
  engagementIdsAreWellFormed,
  resetMentorshipSeedData,
} from '@/src/features/mentorship/seed';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
  { href: '/mentorship/seed', label: 'Seed data console' },
];

/**
 * Administrator-only console for the MENTOR-007 dataset: rebuild with an
 * arbitrary seed, verify determinism, and reset persisted mentorship state.
 */
export default function MentorshipSeedPage() {
  const user = useAuthStore((state) => state.user);
  // Legacy auth-store vocabulary mapped onto the mentorship roles first.
  const role = toIdentityRole(user?.role);
  const allowed = canAccessMentorshipArea(role, 'seed');

  const [seed, setSeed] = useState(7);
  const dataset = buildMentorshipSeedDataset({ seed });
  const rebuilt = buildMentorshipSeedDataset({ seed });
  const deterministic = JSON.stringify(dataset) === JSON.stringify(rebuilt);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const counts: { label: string; value: number }[] = [
    { label: 'Organizations', value: dataset.organizations.length },
    { label: 'Mentors', value: dataset.mentors.length },
    { label: 'Mentees', value: dataset.mentees.length },
    { label: 'Programs', value: dataset.programs.length },
    { label: 'Engagements', value: dataset.engagements.length },
    { label: 'Sessions', value: dataset.sessions.length },
    { label: 'Deliverables', value: dataset.deliverables.length },
    { label: 'Payments', value: dataset.payments.length },
    { label: 'Disputes', value: dataset.disputes.length },
  ];

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Seed data console"
      description={`Dataset v${MENTORSHIP_SEED_VERSION}: deterministic, synthetic, and shaped to demonstrate every lifecycle state.`}
      activeHref="/mentorship/seed"
      navItems={NAV_ITEMS}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">Dataset</h2>
        </header>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label
            htmlFor="seed-value"
            className="block text-xs font-medium text-slate-700"
          >
            Seed (same value rebuilds the same dataset)
          </label>
          <input
            id="seed-value"
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value) || 0)}
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              resetMentorshipSeedData();
              setResetMessage(
                'Persisted mentorship state cleared; persisted stores rebuild on next use.'
              );
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reset persisted state
          </button>
        </div>

        {resetMessage ? (
          <p role="status" className="mt-2 text-xs text-slate-600">
            {resetMessage}
          </p>
        ) : null}

        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3">
          {counts.map((count) => (
            <li key={count.label} className="rounded-xl border border-slate-200 p-3">
              <p className="text-lg font-semibold text-slate-900">{count.value}</p>
              <p className="text-xs text-slate-500">{count.label}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2" role="status">
            <dt className="font-medium text-slate-800">Determinism:</dt>
            <dd>{deterministic ? 'verified (rebuild deep-equals)' : 'FAILED'}</dd>
          </div>
          <div className="flex items-center gap-2" role="status">
            <dt className="font-medium text-slate-800">Well-formed ids:</dt>
            <dd>{engagementIdsAreWellFormed(dataset) ? 'verified' : 'FAILED'}</dd>
          </div>
          <div className="flex items-center gap-2" role="status">
            <dt className="font-medium text-slate-800">Personal data:</dt>
            <dd>none; synthetic names only, no emails</dd>
          </div>
        </dl>

        <p className="mt-6 text-xs text-slate-500">
          The reset action removes persisted keys under{' '}
          <code className="font-mono">chainverse-mentorship-</code> only.
          Unrelated storage survives.
        </p>
      </section>
    </MentorshipPageShell>
  );
}
