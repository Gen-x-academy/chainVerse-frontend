import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CHECK_TRANSITIONS,
  applyProviderUpdate,
  decideCheck,
  needsHumanReview,
  normalizeProviderStatus,
  publicCheck,
  requestCheck,
  type OriginalityCheck,
} from './checks';
import type { IntegrityActor } from './shared';

const owner = (over: Partial<IntegrityActor> = {}): IntegrityActor => ({
  actorId: 'u1',
  tenantId: 't1',
  roles: ['contributor'],
  permissions: ['integrity:checks:request'],
  ...over,
});
const reviewer = (): IntegrityActor => ({ ...owner(), actorId: 'rev1', roles: ['reviewer'], permissions: ['integrity:checks:review'] });
const ingest = (): IntegrityActor => ({ ...owner(), actorId: 'system', roles: ['system'], permissions: ['integrity:checks:ingest'] });

const check = (over: Partial<OriginalityCheck> = {}): OriginalityCheck => ({
  id: 'chk_1', tenantId: 't1', projectId: 'prj_1', submissionVersionId: 'v1',
  status: 'queued', revision: 1, providerStatus: 'pending',
  thresholds: { similarity: 80, citationCoverage: 40 }, ...over,
});
const request = (over = {}) => ({
  requestId: 'req_1', projectId: 'prj_1', submissionVersionId: 'v1',
  consent: { granted: true, scope: 'both' as const, grantedBy: 'u1' },
  thresholds: { similarity: 80, citationCoverage: 40 }, now: '2026-11-20T10:00:00Z', ...over,
});
const scores = (similarity: number, citationCoverage: number) => ({ similarity, citationCoverage, excerptReferences: ['ref_1'] });

describe('CAPSTONE-097 originality checks', () => {
  it('requires explicit consent, valid thresholds and a capable actor', () => {
    expect(requestCheck(owner(), undefined, request({ consent: { ...request().consent, granted: false } }))).toMatchObject({ ok: false, code: 'INTEGRITY_CONSENT_REQUIRED' });
    expect(requestCheck(owner(), undefined, request({ thresholds: { similarity: 101, citationCoverage: 40 } }))).toMatchObject({ ok: false, code: 'INTEGRITY_VALIDATION_FAILED' });
    expect(requestCheck(owner({ permissions: [] }), undefined, request())).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
    expect(requestCheck(owner({ tenantId: '' }), undefined, request())).toMatchObject({ ok: false, code: 'INTEGRITY_FORBIDDEN' });
  });

  it('creates a queued check and never duplicates a running one', () => {
    const ledger = new Map();
    const created = requestCheck(owner(), undefined, request(), ledger);
    expect(created).toMatchObject({ ok: true, value: { status: 'queued', providerStatus: 'pending', revision: 1 } });
    expect(requestCheck(owner(), undefined, request(), ledger)).toMatchObject({ ok: true, replayed: true });
    expect(requestCheck(owner(), check(), request())).toMatchObject({ ok: true, replayed: true });
  });

  it('enforces tenant boundaries, stale revisions and terminal states', () => {
    expect(requestCheck(owner(), check({ tenantId: 't2' }), request())).toMatchObject({ ok: false, code: 'INTEGRITY_TENANT_MISMATCH' });
    expect(requestCheck(owner(), check(), request({ expectedRevision: 9 }))).toMatchObject({ ok: false, code: 'INTEGRITY_STALE_VERSION' });
    expect(requestCheck(owner(), check({ status: 'completed' }), request())).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
    expect(ALLOWED_CHECK_TRANSITIONS.completed).toEqual([]);
  });

  it('normalizes provider status and restricts report payloads', () => {
    expect(normalizeProviderStatus('processing')).toBe('processing');
    expect(normalizeProviderStatus('complete')).toBe('ready');
    const ready = applyProviderUpdate(ingest(), check(), { requestId: 'p1', expectedRevision: 1, status: 'complete', scores: scores(18, 95), now: '2026-11-20T11:00:00Z' });
    expect(ready).toMatchObject({ ok: true, value: { status: 'report_ready', providerStatus: 'ready' } });
    expect(ready.ok && 'scores' in publicCheck(ready.value)).toBe(false);
    expect(needsHumanReview(ready.ok ? ready.value : check())).toBe(true);
  });

  it('requires human review for threshold breaches and rejects stale or invalid transitions', () => {
    const ready = check({ status: 'report_ready', revision: 2, providerStatus: 'ready', scores: scores(91, 95) });
    expect(decideCheck(reviewer(), ready, { requestId: 'd1', expectedRevision: 2, outcome: 'released', reasonCode: 'CLEARED', now: 'x' })).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
    expect(decideCheck(reviewer(), ready, { requestId: 'd2', expectedRevision: 1, outcome: 'escalated', reasonCode: 'THRESHOLD', now: 'x' })).toMatchObject({ ok: false, code: 'INTEGRITY_STALE_VERSION' });
    expect(decideCheck(reviewer(), ready, { requestId: 'd3', expectedRevision: 2, outcome: 'escalated', reasonCode: 'THRESHOLD', now: '2026-11-20T12:00:00Z' })).toMatchObject({ ok: true, value: { status: 'human_review', decision: { reasonCode: 'THRESHOLD' } } });
    expect(decideCheck(reviewer(), { ...ready, status: 'human_review' }, { requestId: 'd4', expectedRevision: 2, outcome: 'escalated', reasonCode: 'THRESHOLD', now: 'x' })).toMatchObject({ ok: false, code: 'INTEGRITY_INVALID_TRANSITION' });
  });

  it('replays a review decision so concurrent retries cannot duplicate it', () => {
    const ledger = new Map();
    const ready = check({ status: 'report_ready', revision: 2, providerStatus: 'ready', scores: scores(20, 95) });
    const input = { requestId: 'd5', expectedRevision: 2, outcome: 'released' as const, reasonCode: 'CLEARED', now: '2026-11-20T12:00:00Z' };
    expect(decideCheck(reviewer(), ready, input, ledger)).toMatchObject({ ok: true, replayed: false });
    expect(decideCheck(reviewer(), ready, input, ledger)).toMatchObject({ ok: true, replayed: true });
  });
});
