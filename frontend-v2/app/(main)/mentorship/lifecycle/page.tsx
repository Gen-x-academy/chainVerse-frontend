'use client';

import { useState } from 'react';
import { Workflow } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import { MentorshipPageShell, canAccessMentorshipArea } from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import {
  type EngagementWithHistory,
  applyEngagementTransition,
  allowedEngagementTransitions,
} from '@/src/features/mentorship/engagements/lifecycle-state-machine';
import { type EngagementState } from '@/src/features/mentorship';
import { buildMentorshipSeedDataset } from '@/src/features/mentorship/seed';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
  { href: '/mentorship/lifecycle', label: 'Engagement lifecycle' },
];

const STATUS_STYLES: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-700',
  accepted: 'bg-sky-100 text-sky-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  declined: 'bg-gray-100 text-gray-600',
  withdrawn: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-600',
  disputed: 'bg-red-100 text-red-700',
};

/** Demonstrates the MENTOR-004 machine with the MENTOR-007 seed data. */
export default function MentorshipLifecyclePage() {
  const user = useAuthStore((state) => state.user);
  // The auth store still carries the legacy `admin | instructor | student`
  // vocabulary; map it before the mentorship role check (see identity/access).
  const role = toIdentityRole(user?.role);
  const allowed = canAccessMentorshipArea(role, 'lifecycle');

  const seedEngagements = buildMentorshipSeedDataset({ seed: 7 }).engagements;
  const [board, setBoard] = useState<EngagementWithHistory[]>(() =>
    seedEngagements.map((engagement) => ({
      engagementId: engagement.id,
      status: engagement.status,
      history: [],
    })),
  );

  const transitionAndRecord = (engagementId: string, to: EngagementState) => {
    setBoard((current) =>
      current.map((engagement) => {
        if (engagement.engagementId !== engagementId) return engagement;
        const outcome = applyEngagementTransition(engagement, to, {
          actorId: 'lifecycle-console',
          actorRole: 'organization-staff',
          reason: 'Recorded from the engagement lifecycle console.',
          occurredAt: new Date().toISOString(),
        });
        return outcome.ok ? outcome.engagement : engagement;
      }),
    );
  };

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Engagement lifecycle"
      description="Apply lifecycle transitions with a full prior-state, actor, reason, and timestamp audit trail."
      activeHref="/mentorship/lifecycle"
      navItems={NAV_ITEMS}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">
            Lifecycle board (seed data demo)
          </h2>
        </header>
        <ul className="mt-4 space-y-4">
          {board.map((engagement) => (
            <li key={engagement.engagementId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium text-slate-900">
                    {engagement.engagementId}
                  </p>
                  <p className="text-xs text-slate-500">
                    {engagement.history.length} recorded transition(s); latest status{' '}
                    {engagement.status}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[engagement.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {engagement.status}
                </span>
              </div>
              {allowedEngagementTransitions(engagement.status).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowedEngagementTransitions(engagement.status).map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => transitionAndRecord(engagement.engagementId, target)}
                      className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Move to {target}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Terminal state; no further transitions are legal.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </MentorshipPageShell>
  );
}
