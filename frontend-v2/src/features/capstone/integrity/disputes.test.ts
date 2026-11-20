import { describe, expect, it } from 'vitest';
import { appealDispute, applyRemedy, decideDispute, fileDispute, publicDispute, respondToDispute, type ProjectDispute } from './disputes';
import type { IntegrityActor } from './shared';

const claimant = (over: Partial<IntegrityActor> = {}): IntegrityActor => ({
  actorId: 'u1', tenantId: 't1', roles: ['contributor'],
  permissions: ['integrity:disputes:file', 'integrity:disputes:read'], ...over,
});
const respondent = (): IntegrityActor => ({ ...claimant(), actorId: 'u2', permissions: ['integrity:disputes:read'] });
const reviewer = (): IntegrityActor => ({ ...claimant(), actorId: 'rev1', roles: ['reviewer'], permissions: ['integrity:disputes:read', 'integrity:disputes:decide'] });
const input = (over = {}) => ({
  requestId: 'r1', projectId: 'p1', type: 'team' as const, respondentId: 'u2', reasonCode: 'OWNERSHIP',
  evidenceRefs: ['ev_a1'], responseDeadline: '2026-12-01T00:00:00Z', appealDeadline: '2026-12-15T00:00:00Z', now: '2026-11-20T10:00:00Z', ...over,
});
const decided = (over: Partial<ProjectDispute> = {}): ProjectDispute => ({
  id: 'dsp_1', tenantId: 't1', projectId: 'p1', type: 'team', claimantId: 'u1', respondentId: 'u2',
  status: 'decided', reasonCode: 'OWNERSHIP', evidenceRefs: ['ev_a1'], responseDeadline: '2026-12-01T00:00:00Z',
  appealDeadline: '2026-12-15T00:00:00Z', responses: [{ actorId: 'u2', reasonCode: 'EXPLAINED', at: 'x' }],
  outcome: { reasonCode: 'REASONED', remedyCode: 'REASSIGN', decidedBy: 'rev1', decidedAt: 'x' }, revision: 3, ...over,
});

describe('CAPSTONE-102 project disputes', () => {
  it('files a typed dispute with deadlines and opaque evidence only', () => {
    const ledger = new Map();
    const filed = fileDispute(claimant(), input(), ledger);
    expect(filed).toMatchObject({ ok: true, value: { status: 'open', claimantId: 'u1', revision: 1 } });
    expect(fileDispute(claimant(), input(), ledger)).toMatchObject({ ok: true, replayed: true });
    expect(fileDispute(claimant(), input({ type: 'unknown' as never }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(fileDispute(claimant(), input({ evidenceRefs: ['private identity'] }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(fileDispute(claimant(), input({ responseDeadline: '2020-01-01T00:00:00Z' }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(fileDispute(claimant({ permissions: [] }), input())).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect('evidenceRefs' in publicDispute(filed.ok ? filed.value : decided())).toBe(false);
  });

  it('allows only a party to respond and rejects stale or expired responses', () => {
    const filed = fileDispute(claimant(), input()).value;
    const response = { requestId: 'p1', expectedRevision: 1, reasonCode: 'EXPLAINED', now: '2026-11-21T10:00:00Z' };
    expect(respondToDispute(claimant(), filed, response)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(respondToDispute(respondent(), filed, response)).toMatchObject({ ok: true, value: { status: 'responded', responses: [{ reasonCode: 'EXPLAINED' }] } });
    expect(respondToDispute(respondent(), filed, { ...response, requestId: 'p1' }, new Map([['p1', respondToDispute(respondent(), filed, response)]]))).toMatchObject({ ok: true, replayed: true });
    expect(respondToDispute(respondent(), filed, { ...response, expectedRevision: 9 })).toMatchObject({ ok: false, code: 'INTEGRITY_STALE_VERSION' });
    expect(respondToDispute(respondent(), filed, { ...response, now: '2026-12-02T10:00:00Z' })).toMatchObject({ ok: false, code: 'INTEGRITY_DEADLINE_PASSED' });
  });

  it('requires an authorized reviewer and a reasoned outcome', () => {
    const responded = { ...fileDispute(claimant(), input()).value, status: 'responded' as const, revision: 2 };
    const decision = { requestId: 'd1', expectedRevision: 2, reasonCode: 'REASONED', remedyCode: 'REASSIGN', now: 'x' };
    expect(decideDispute(respondent(), responded, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(decideDispute(reviewer(), responded, { ...decision, reasonCode: ' ' })).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(decideDispute(reviewer(), responded, decision)).toMatchObject({ ok: true, value: { status: 'decided', outcome: { remedyCode: 'REASSIGN' } } });
    expect(decideDispute(reviewer(), { ...responded, tenantId: 't2' }, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_TENANT_MISMATCH' });
  });

  it('enforces appeal windows and rejects invalid or stale appeals', () => {
    const appeal = { requestId: 'ap1', expectedRevision: 3, reasonCode: 'NEW_EVIDENCE', now: '2026-11-25T10:00:00Z' };
    expect(appealDispute(reviewer(), decided(), appeal)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(appealDispute(claimant(), decided(), appeal)).toMatchObject({ ok: true, value: { status: 'appealed', appeal: { reasonCode: 'NEW_EVIDENCE' } } });
    expect(appealDispute(claimant(), decided(), { ...appeal, now: '2026-12-20T10:00:00Z' })).toMatchObject({ ok: false, code: 'INTEGRITY_DEADLINE_PASSED' });
    expect(appealDispute(claimant(), decided({ status: 'open' }), appeal)).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
  });

  it('applies a remedy once and replays concurrent retries', () => {
    const remedy = { requestId: 'rem1', expectedRevision: 3, remedyCode: 'REASSIGN', now: 'x' };
    const ledger = new Map();
    expect(applyRemedy(reviewer(), decided(), remedy, ledger)).toMatchObject({ ok: true, value: { status: 'remedied', remedy: { requestId: 'rem1' } } });
    expect(applyRemedy(reviewer(), decided(), remedy, ledger)).toMatchObject({ ok: true, replayed: true });
    expect(applyRemedy(reviewer(), decided({ status: 'remedied', remedy: { remedyCode: 'REASSIGN', requestId: 'old', appliedBy: 'rev1', at: 'x' } }), { ...remedy, requestId: 'rem2' })).toMatchObject({ ok: true, replayed: true });
    expect(applyRemedy(reviewer(), decided(), { ...remedy, remedyCode: 'OTHER' })).toMatchObject({ ok: false, code: 'INTEGRITY_CONFLICT' });
  });
});
