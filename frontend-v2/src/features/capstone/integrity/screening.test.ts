import { describe, expect, it } from 'vitest';
import { decideScreening, recordMaterialChange, requiredPathway, startScreening, submitAssessment, type ScreeningFlags } from './screening';
import type { IntegrityActor } from './shared';

const owner = (over: Partial<IntegrityActor> = {}): IntegrityActor => ({
  actorId: 'u1', tenantId: 't1', roles: ['contributor'],
  permissions: ['integrity:screening:create'], ...over,
});
const approver = (): IntegrityActor => ({ ...owner(), actorId: 'a1', roles: ['approver'], permissions: ['integrity:screening:decide'] });
const clean: ScreeningFlags = { humanSubjects: false, sensitiveData: false, fieldwork: false, dualUse: false, safetyConcerns: false };
const input = (over = {}) => ({ requestId: 'r1', projectId: 'p1', projectVersion: 1, flags: { ...clean }, now: '2026-11-20T10:00:00Z', ...over });

describe('CAPSTONE-098 research ethics screening', () => {
  it('derives approval pathways and blocks unmitigated dual use', () => {
    expect(requiredPathway(clean)).toBe('exempt');
    expect(requiredPathway({ ...clean, humanSubjects: true })).toBe('expedited');
    expect(requiredPathway({ ...clean, sensitiveData: true })).toBe('full_board');
    expect(requiredPathway({ ...clean, dualUse: true })).toBe('blocked');
    expect(requiredPathway({ ...clean, dualUse: true, safetyMitigation: true })).toBe('full_board');
  });

  it('starts a screening with deny-by-default authorization and idempotency', () => {
    const ledger = new Map();
    const started = startScreening(owner(), input(), ledger);
    expect(started).toMatchObject({ ok: true, value: { status: 'screening', revision: 1, pathway: 'exempt' } });
    expect(startScreening(owner(), input(), ledger)).toMatchObject({ ok: true, replayed: true });
    expect(startScreening(owner({ permissions: [] }), input())).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(startScreening(owner(), input({ projectVersion: 0 }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
  });

  it('routes assessments to approval, exemption or block and replays retries', () => {
    const started = startScreening(owner(), input());
    const assess = { requestId: 'a1', expectedRevision: 1, flags: { ...clean, humanSubjects: true }, now: 'x' };
    const ledger = new Map();
    expect(submitAssessment(owner(), started.value, assess, ledger)).toMatchObject({ ok: true, value: { status: 'pending_approval', pathway: 'expedited' } });
    expect(submitAssessment(owner(), started.value, assess, ledger)).toMatchObject({ ok: true, replayed: true });
    const blocked = startScreening(owner(), input({ requestId: 'b1', flags: { ...clean, dualUse: true } }));
    expect(submitAssessment(owner(), blocked.value, { ...assess, requestId: 'b2', flags: { ...clean, dualUse: true } })).toMatchObject({ ok: true, value: { status: 'blocked', pathway: 'blocked' } });
    expect(submitAssessment(owner(), started.value, { ...assess, requestId: 'a2', expectedRevision: 9 })).toMatchObject({ ok: false, code: 'INTEGRITY_STALE_VERSION' });
  });

  it('requires an approver, rejects invalid transitions and enforces tenant boundaries', () => {
    const pending = { ...startScreening(owner(), input()).value, status: 'pending_approval' as const, revision: 2, pathway: 'expedited' as const };
    const decision = { requestId: 'd1', expectedRevision: 2, outcome: 'approved' as const, reasonCode: 'IRB_OK', now: 'x' };
    expect(decideScreening(owner(), pending, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(decideScreening(approver(), pending, decision)).toMatchObject({ ok: true, value: { status: 'approved', decision: { reasonCode: 'IRB_OK' } } });
    expect(decideScreening(approver(), { ...pending, tenantId: 't2' }, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_TENANT_MISMATCH' });
    expect(decideScreening(approver(), pending, { ...decision, requestId: 'd2' })).toMatchObject({ ok: true });
    expect(decideScreening(approver(), { ...pending, status: 'blocked' }, decision)).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
  });

  it('invalidates approval on a material change with a newer version', () => {
    const approved = { ...startScreening(owner(), input()).value, status: 'approved' as const, revision: 3, projectVersion: 1 };
    const change = { requestId: 'm1', expectedRevision: 3, projectVersion: 2, now: 'x' };
    const ledger = new Map();
    expect(recordMaterialChange(owner(), approved, change, ledger)).toMatchObject({ ok: true, value: { status: 'screening', projectVersion: 2, decision: undefined } });
    expect(recordMaterialChange(owner(), approved, change, ledger)).toMatchObject({ ok: true, replayed: true });
    expect(recordMaterialChange(owner(), approved, { ...change, requestId: 'm2', projectVersion: 1 })).toMatchObject({ ok: false, code: 'INTEGRITY_CONFLICT' });
  });
});
