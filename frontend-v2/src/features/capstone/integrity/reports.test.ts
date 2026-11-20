import { describe, expect, it } from 'vitest';
import { MAX_EVIDENCE_REFS, REPORT_CATEGORIES, resolveReport, submitReport, triageReport, type IntegrityReport } from './reports';
import type { IntegrityActor } from './shared';

const reporter = (over: Partial<IntegrityActor> = {}): IntegrityActor => ({
  actorId: 'u1', tenantId: 't1', roles: ['contributor'], permissions: ['integrity:reports:submit'], ...over,
});
const triager = (): IntegrityActor => ({ ...reporter(), actorId: 'rev1', roles: ['reviewer'], permissions: ['integrity:reports:triage'] });
const input = (over = {}) => ({
  requestId: 'r1', projectId: 'p1', category: 'authorship' as const, severity: 'medium' as const,
  evidenceRefs: ['ev_a1'], contactPreference: 'platform_email' as const, now: '2026-11-20T10:00:00Z', ...over,
});
const investigating = (over: Partial<IntegrityReport> = {}): IntegrityReport => ({
  id: 'rep_1', tenantId: 't1', projectId: 'p1', reporterId: 'u1', category: 'authorship',
  severity: 'medium', status: 'investigating', evidenceRefs: ['ev_a1'], contactPreference: 'none', revision: 2, ...over,
});

describe('CAPSTONE-099 integrity reports', () => {
  it('validates categories and opaque evidence references', () => {
    expect(REPORT_CATEGORIES).toContain('fabrication');
    expect(submitReport(reporter(), input({ category: 'unknown' as never }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(submitReport(reporter(), input({ evidenceRefs: Array.from({ length: MAX_EVIDENCE_REFS + 1 }, (_, i) => `ev_${i}`) }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(submitReport(reporter(), input({ evidenceRefs: ['private manuscript text'] }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
  });

  it('submits once per request id with deny-by-default authorization', () => {
    const ledger = new Map();
    const submit = input();
    expect(submitReport(reporter(), submit, ledger)).toMatchObject({ ok: true, value: { status: 'submitted', reporterId: 'u1', revision: 1 } });
    expect(submitReport(reporter(), submit, ledger)).toMatchObject({ ok: true, replayed: true });
    expect(submitReport(reporter({ permissions: [] }), submit)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
  });

  it('triages only submitted reports and replay is side-effect free', () => {
    const report = submitReport(reporter(), input());
    const decision = { requestId: 't1', expectedRevision: 1, decision: 'accept' as const, reasonCode: 'SCREENED', now: 'x' };
    const ledger = new Map();
    expect(triageReport(reporter(), report.value, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(triageReport(triager(), report.value, decision, ledger)).toMatchObject({ ok: true, value: { status: 'investigating', assignedTo: 'rev1' } });
    expect(triageReport(triager(), report.value, decision, ledger)).toMatchObject({ ok: true, replayed: true });
    expect(triageReport(triager(), { ...report.value, status: 'dismissed' }, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
    expect(triageReport(triager(), { ...report.value, tenantId: 't2' }, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_TENANT_MISMATCH' });
  });

  it('requires a reasoned outcome and rejects stale resolution', () => {
    const decision = { requestId: 'd1', expectedRevision: 2, outcome: 'upheld' as const, reasonCode: 'EVIDENCE', now: 'x' };
    expect(resolveReport(triager(), investigating(), { ...decision, reasonCode: ' ' })).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(resolveReport(triager(), investigating(), { ...decision, expectedRevision: 1 })).toMatchObject({ ok: false, code: 'INTEGRITY_STALE_VERSION' });
    expect(resolveReport(triager(), investigating(), decision)).toMatchObject({ ok: true, value: { status: 'resolved', resolution: { reasonCode: 'EVIDENCE' } } });
    expect(resolveReport(triager(), investigating({ status: 'resolved' }), decision)).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
  });
});
