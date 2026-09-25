'use client';

import { useMemo, type ReactNode } from 'react';
import { computeFunnel, FUNNEL_DEFINITIONS_VERSION, type FunnelEvent } from '../analytics';
import { buildSponsorImpactReport, canDrillIntoStudent, type SponsorImpactRow } from '../impact';
import { evaluateAllSlis, SCHOLARSHIP_SLIS, type ObservabilitySample } from '../sli';

const funnelEvents: FunnelEvent[] = [
  { id: 'e1', stage: 'program_view', programId: 'program-1', occurredAt: '2026-09-20T10:00:00.000Z', actorKey: 'actor-1', dedupeKey: 'view-1' },
  { id: 'e2', stage: 'application_start', programId: 'program-1', occurredAt: '2026-09-20T10:01:00.000Z', actorKey: 'actor-1', dedupeKey: 'start-1' },
  { id: 'e3', stage: 'application_submit', programId: 'program-1', occurredAt: '2026-09-21T09:00:00.000Z', actorKey: 'actor-1', dedupeKey: 'submit-1' },
  { id: 'e4', stage: 'application_submit', programId: 'program-1', occurredAt: '2026-09-21T09:00:30.000Z', actorKey: 'actor-1', dedupeKey: 'submit-1' },
];

function impactRows(count: number): SponsorImpactRow[] {
  return Array.from({ length: count }, (_, index) => ({
    sponsorId: 'sponsor-1',
    programId: 'program-1',
    studentId: `student-${index + 1}`,
    fundedAmount: 500,
    completed: index % 2 === 0,
    credentialIssued: index % 3 === 0,
  }));
}

const samples: ObservabilitySample[] = [
  { sliId: 'api.latency.p95', value: 420, observedAt: '2026-09-24T10:00:00.000Z' },
  { sliId: 'api.error.rate', value: 2.4, observedAt: '2026-09-24T10:00:00.000Z', correlationId: 'corr-1' },
];

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function ScholarshipAnalyticsPanel() {
  const funnel = useMemo(
    () =>
      computeFunnel(funnelEvents, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      }),
    []
  );

  const largeReport = useMemo(
    () => buildSponsorImpactReport(impactRows(6), { sponsorId: 'sponsor-1', programId: 'program-1' }),
    []
  );

  const smallReport = useMemo(
    () => buildSponsorImpactReport(impactRows(3), { sponsorId: 'sponsor-1', programId: 'program-1' }),
    []
  );

  const slis = useMemo(() => evaluateAllSlis(samples), []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scholarships analytics &amp; observability
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Funnel metrics, sponsor impact &amp; SLIs
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Versioned funnel definitions with deduplicated events and visible freshness, privacy-safe
          sponsor impact reporting, and operational service-level indicators.
        </p>
      </header>

      <Panel
        title="Scholarship funnel"
        description={`Definitions version ${FUNNEL_DEFINITIONS_VERSION}; retries are never double counted.`}
      >
        <p>
          Data through:{' '}
          {funnel.dataThrough.slice(0, 19).replace('T', ' ')}
        </p>
        <ul className="list-disc pl-5" aria-label="Funnel stage counts">
          <li>Program views: {funnel.counts.program_view}</li>
          <li>Application starts: {funnel.counts.application_start}</li>
          <li>Submissions: {funnel.counts.application_submit}</li>
        </ul>
        <p>
          Start rate: {((funnel.conversionRates.application_start ?? 0) * 100).toFixed(0)}% ·
          Submit rate: {((funnel.conversionRates.application_submit ?? 0) * 100).toFixed(0)}%
        </p>
      </Panel>

      <Panel
        title="Sponsor impact reporting"
        description="Small groups are suppressed and sponsors cannot drill into student data."
      >
        <p>
          Large group: recipients {largeReport.metrics.recipients ?? 'suppressed'}, completion rate{' '}
          {(largeReport.metrics.aggregateOutcomeRate ?? 0) * 100}%
        </p>
        <p>
          Small group: {smallReport.smallGroupSuppressed ? 'suppressed to protect learners' : 'reported'}
        </p>
        <p>
          Sponsor drill-down allowed:{' '}
          {canDrillIntoStudent({ id: 'sponsor-1', role: 'sponsor' }, impactRows(1)[0]) ? 'yes' : 'no'}
        </p>
      </Panel>

      <Panel
        title="Operational service-level indicators"
        description="Each indicator has a target, a comparison direction, and a burn rate."
      >
        <ul className="space-y-2" aria-label="Service level indicator status">
          {slis.map((sli) => (
            <li key={sli.sliId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="font-medium">{sli.name}</span> — {sli.status}
              {sli.current !== null && ` (current ${sli.current}${sli.unit}, target ${sli.target}${sli.unit})`}
            </li>
          ))}
        </ul>
        <p>{SCHOLARSHIP_SLIS.length} indicators tracked.</p>
      </Panel>
    </section>
  );
}

export default ScholarshipAnalyticsPanel;
