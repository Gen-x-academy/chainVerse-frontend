'use client';

import { useMemo, type ReactNode } from 'react';
import { MENTORSHIP_SLOS, type MentorshipSloEvaluation, type MentorshipSloSample } from '../types';

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

const SAMPLES: MentorshipSloSample[] = [
  { sloId: 'latency.p95', value: 420, observedAt: '2026-10-01T10:00:00.000Z' },
  { sloId: 'availability', value: 99.95, observedAt: '2026-10-01T10:00:00.000Z' },
  { sloId: 'notification.success', value: 99.7, observedAt: '2026-10-01T10:00:00.000Z' },
];

function evaluate(): MentorshipSloEvaluation[] {
  return MENTORSHIP_SLOS.map((slo) => {
    const sample = SAMPLES.find((s) => s.sloId === slo.id);
    if (!sample) {
      return {
        sloId: slo.id,
        name: slo.name,
        target: slo.target,
        unit: slo.unit,
        current: null,
        status: 'no-data' as const,
        burnRate: null,
        owner: slo.owner,
      };
    }
    const breached =
      slo.comparison === 'max' ? sample.value > slo.target : sample.value < slo.target;
    return {
      sloId: slo.id,
      name: slo.name,
      target: slo.target,
      unit: slo.unit,
      current: sample.value,
      status: breached ? ('breach' as const) : ('ok' as const),
      burnRate: slo.target === 0 ? null : Number((sample.value / slo.target).toFixed(2)),
      owner: slo.owner,
    };
  });
}

export function MentorshipSloPanel() {
  const evaluations = useMemo(() => evaluate(), []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Mentorship service-level objectives
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">SLO dashboard &amp; error budget</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Latency, availability, job delay, notification success, calendar sync, search freshness,
          settlement, and error-budget indicators with owners and alert thresholds.
        </p>
      </header>

      <Panel
        title="SLO status"
        description="Metrics exclude high-cardinality personal fields. Dashboards show burn rate."
      >
        <ul className="space-y-2" aria-label="Service level objective status">
          {evaluations.map((slo) => (
            <li key={slo.sloId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="font-medium">{slo.name}</span> — {slo.status}
              {slo.current !== null &&
                ` (current ${slo.current}${slo.unit}, target ${slo.target}${slo.unit}, burn ${slo.burnRate})`}
              <p className="text-xs text-slate-500">Owner: {slo.owner}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Alerts link to runbooks; retries do not duplicate effects.
        </p>
      </Panel>
    </section>
  );
}

export default MentorshipSloPanel;
