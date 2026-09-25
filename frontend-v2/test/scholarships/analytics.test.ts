import { describe, expect, it } from 'vitest';
import {
  assertNoPrivateFields,
  computeFunnel,
  dedupeFunnelEvents,
  FUNNEL_DEFINITIONS_VERSION,
  type FunnelEvent,
} from '@/src/features/scholarships/analytics';
import {
  buildSponsorImpactReport,
  canDrillIntoStudent,
  type SponsorImpactRow,
} from '@/src/features/scholarships/impact';
import {
  evaluateAllSlis,
  evaluateSli,
  sanitizeCorrelationId,
  SCHOLARSHIP_SLIS,
} from '@/src/features/scholarships/sli';

const events: FunnelEvent[] = [
  { id: 'e1', stage: 'program_view', programId: 'program-1', occurredAt: '2026-09-20T10:00:00.000Z', actorKey: 'actor-1', dedupeKey: 'view-1' },
  { id: 'e1-retry', stage: 'program_view', programId: 'program-1', occurredAt: '2026-09-20T10:00:01.000Z', actorKey: 'actor-1', dedupeKey: 'view-1' },
  { id: 'e2', stage: 'application_start', programId: 'program-1', occurredAt: '2026-09-20T10:01:00.000Z', actorKey: 'actor-1', dedupeKey: 'start-1' },
  { id: 'e3', stage: 'application_submit', programId: 'program-1', occurredAt: '2026-09-21T09:02:00.000Z', actorKey: 'actor-1', dedupeKey: 'submit-1' },
  { id: 'e4', stage: 'application_submit', programId: 'program-1', occurredAt: '2026-10-05T09:00:00.000Z', actorKey: 'actor-2', dedupeKey: 'submit-2' },
];

describe('scholarship funnel metrics (#1158)', () => {
  it('deduplicates events by dedupe key', () => {
    expect(dedupeFunnelEvents(events)).toHaveLength(4);
  });

  it('counts stages inside the window and reports freshness', () => {
    const snapshot = computeFunnel(events, {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(snapshot.definitionsVersion).toBe(FUNNEL_DEFINITIONS_VERSION);
    expect(snapshot.counts.program_view).toBe(1);
    expect(snapshot.counts.application_start).toBe(1);
    expect(snapshot.counts.application_submit).toBe(1);
    expect(snapshot.conversionRates.application_start).toBe(1);
    expect(snapshot.dataThrough).toBe('2026-09-21T09:02:00.000Z');
  });

  it('returns zero conversion when a stage has no events', () => {
    const snapshot = computeFunnel([], {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(snapshot.counts.program_view).toBe(0);
    expect(snapshot.conversionRates.application_start).toBe(0);
  });

  it('flags private fields before an event is accepted', () => {
    expect(assertNoPrivateFields({ programId: 'program-1', email: 'a@b.c', token: 'x' })).toEqual([
      'email',
      'token',
    ]);
    expect(assertNoPrivateFields({ programId: 'program-1', stage: 'program_view' })).toEqual([]);
  });
});

describe('sponsor impact reporting (#1159)', () => {
  const rows = (count: number): SponsorImpactRow[] =>
    Array.from({ length: count }, (_, index) => ({
      sponsorId: 'sponsor-1',
      programId: 'program-1',
      studentId: `student-${index + 1}`,
      fundedAmount: 500,
      completed: index % 2 === 0,
      credentialIssued: index % 3 === 0,
    }));

  it('suppresses small groups', () => {
    const report = buildSponsorImpactReport(rows(3), {
      sponsorId: 'sponsor-1',
      programId: 'program-1',
    });

    expect(report.smallGroupSuppressed).toBe(true);
    expect(report.metrics.recipients).toBeNull();
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it('reports aggregate outcomes for large groups', () => {
    const report = buildSponsorImpactReport(rows(6), {
      sponsorId: 'sponsor-1',
      programId: 'program-1',
    });

    expect(report.smallGroupSuppressed).toBe(false);
    expect(report.metrics.recipients).toBe(6);
    expect(report.metrics.completions).toBe(3);
    expect(report.metrics.aggregateOutcomeRate).toBe(0.5);
  });

  it('never lets a sponsor drill into student data', () => {
    const row = rows(1)[0];
    expect(canDrillIntoStudent({ id: 'sponsor-1', role: 'sponsor' }, row)).toBe(false);
    expect(canDrillIntoStudent({ id: 'student-1', role: 'student' }, row)).toBe(true);
    expect(canDrillIntoStudent({ id: 'support-1', role: 'support' }, row)).toBe(true);
  });
});

describe('operational service-level indicators (#1160)', () => {
  it('flags a breach against the target', () => {
    const definition = SCHOLARSHIP_SLIS.find((sli) => sli.id === 'api.error.rate')!;
    const evaluation = evaluateSli(definition, [
      { sliId: 'api.error.rate', value: 2.4, observedAt: '2026-09-24T10:00:00.000Z' },
    ]);

    expect(evaluation.status).toBe('breach');
    expect(evaluation.burnRate).toBe(2.4);
  });

  it('reports no-data for indicators without samples', () => {
    const evaluation = evaluateSli(SCHOLARSHIP_SLIS[0], []);
    expect(evaluation.status).toBe('no-data');
    expect(evaluation.current).toBeNull();
  });

  it('evaluates every indicator', () => {
    const evaluations = evaluateAllSlis([
      { sliId: 'api.latency.p95', value: 420, observedAt: '2026-09-24T10:00:00.000Z' },
    ]);

    expect(evaluations).toHaveLength(SCHOLARSHIP_SLIS.length);
    expect(evaluations.find((sli) => sli.sliId === 'api.latency.p95')?.status).toBe('ok');
    expect(evaluations.find((sli) => sli.sliId === 'queue.age.p95')?.status).toBe('no-data');
  });

  it('sanitizes correlation ids without leaking secrets', () => {
    expect(sanitizeCorrelationId('corr-123')).toBe('corr-123');
    expect(sanitizeCorrelationId('request?token=abc123')).toBe('redacted');
    expect(sanitizeCorrelationId('   ')).toBe('unknown');
  });
});
