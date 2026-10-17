'use client';

import { useMemo, type ReactNode } from 'react';
import type { MentorDashboardData } from '../types';

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

const SAMPLE: MentorDashboardData = {
  mentorId: 'mentor-1',
  tenantId: 'tenant-1',
  sessions: [
    { id: 's1', title: 'Intro session', startsAt: '2026-10-18T10:00:00.000Z', menteeAlias: 'Mentee A', status: 'scheduled' },
    { id: 's2', title: 'Review session', startsAt: '2026-10-19T14:00:00.000Z', menteeAlias: 'Mentee B', status: 'scheduled' },
  ],
  applications: [
    { id: 'a1', menteeAlias: 'Mentee C', programId: 'program-1', submittedAt: '2026-10-15T09:00:00.000Z', status: 'pending' },
  ],
  activeMentees: 3,
  tasks: [
    { id: 't1', title: 'Prepare curriculum', dueAt: '2026-10-20', done: false },
    { id: 't2', title: 'Verify milestone 1', dueAt: '2026-10-21', done: false, milestoneId: 'm1' },
  ],
  milestones: [{ id: 'm1', title: 'Week 1 review', dueAt: '2026-10-22', completed: false }],
  availabilityGaps: ['2026-10-18 12:00-13:00', '2026-10-19 09:00-10:00'],
  earnings: { currency: 'USD', pending: 450, settled: 1200, period: '2026-10' },
  alerts: [
    { id: 'al1', severity: 'warning', message: '2 pending applications need review', href: '/mentorship/operations' },
  ],
  generatedAt: '2026-10-17T08:00:00.000Z',
};

export function MentorOperationsDashboardPanel() {
  const data = useMemo(() => SAMPLE, []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Mentor operations dashboard
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your mentorship operations</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Upcoming sessions, applications, active mentees, tasks, milestones, availability gaps,
          earnings summary, and alerts — role-scoped and prioritized.
        </p>
      </header>

      <Panel title="Alerts" description="Urgent actions are prioritized.">
        {data.alerts.length === 0 ? (
          <p role="status">No alerts.</p>
        ) : (
          <ul className="list-disc pl-5" aria-label="Mentor alerts">
            {data.alerts.map((alert) => (
              <li key={alert.id}>
                <span className="font-medium">{alert.severity}</span>: {alert.message}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Upcoming sessions" description="Private counterpart information is minimized.">
        <ul className="list-disc pl-5" aria-label="Upcoming sessions">
          {data.sessions.map((s) => (
            <li key={s.id}>
              {s.title} · {s.menteeAlias} · {s.startsAt}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Applications / proposals" description="Pending items surface first.">
        <ul className="list-disc pl-5" aria-label="Applications">
          {data.applications.map((a) => (
            <li key={a.id}>
              {a.menteeAlias} · {a.programId} · {a.status}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tasks &amp; milestones" description="Guided setup for empty states.">
        <p>Active mentees: {data.activeMentees}</p>
        <ul className="mt-2 list-disc pl-5" aria-label="Tasks">
          {data.tasks.map((t) => (
            <li key={t.id}>
              {t.title} · due {t.dueAt} {t.done ? '· done' : ''}
            </li>
          ))}
        </ul>
        <ul className="mt-2 list-disc pl-5" aria-label="Milestones">
          {data.milestones.map((m) => (
            <li key={m.id}>
              {m.title} · due {m.dueAt}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Availability gaps &amp; earnings" description="Totals reconcile; minimized private data.">
        <p>Availability gaps: {data.availabilityGaps.join(', ') || 'none'}</p>
        <p>
          Earnings ({data.earnings.currency}): pending {data.earnings.pending}, settled{' '}
          {data.earnings.settled} for {data.earnings.period}
        </p>
        <p className="text-xs text-slate-500">
          Data generated {data.generatedAt} · deny-by-default authorization
        </p>
      </Panel>
    </section>
  );
}

export default MentorOperationsDashboardPanel;
