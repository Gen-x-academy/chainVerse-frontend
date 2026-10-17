'use client';

import { useMemo, type ReactNode } from 'react';
import { MENTORSHIP_ANALYTICS_DEFINITIONS_VERSION, type MentorshipAnalyticsRow } from '../types';

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

const SAMPLE: MentorshipAnalyticsRow = {
  programId: 'program-1',
  cohortId: 'cohort-1',
  tenantId: 'tenant-1',
  applications: 24,
  eligible: 20,
  matches: 16,
  activated: 14,
  attendance: 0.9,
  completion: 0.85,
  waitTimeP50: 2,
  waitTimeP95: 7,
  retention: 0.8,
  outcomes: 0.75,
};

export function MentorshipProgramAnalyticsPanel() {
  const rows = useMemo(() => [SAMPLE], []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Mentorship program analytics
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Privacy-safe program metrics
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Applications, eligibility, matches, activation, attendance, completion, wait time,
          retention, and outcomes by authorized program/cohort dimensions.
        </p>
      </header>

      <Panel
        title="Metrics"
        description={`Definitions version ${MENTORSHIP_ANALYTICS_DEFINITIONS_VERSION}. Small groups are suppressed; totals reconcile.`}
      >
        <ul className="list-disc pl-5" aria-label="Program analytics metrics">
          <li>Applications: {rows[0].applications}</li>
          <li>Eligible: {rows[0].eligible}</li>
          <li>Matches: {rows[0].matches}</li>
          <li>Activated: {rows[0].activated}</li>
          <li>Attendance: {(rows[0].attendance ?? 0) * 100}%</li>
          <li>Completion: {(rows[0].completion ?? 0) * 100}%</li>
          <li>Wait time p50/p95: {rows[0].waitTimeP50}/{rows[0].waitTimeP95} days</li>
          <li>Retention: {(rows[0].retention ?? 0) * 100}%</li>
          <li>Outcomes: {(rows[0].outcomes ?? 0) * 100}%</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Denominators explicit, freshness tracked, access scoped. Exports cannot reveal small groups.
        </p>
      </Panel>
    </section>
  );
}

export default MentorshipProgramAnalyticsPanel;
