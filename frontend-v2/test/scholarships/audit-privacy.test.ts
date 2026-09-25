import { describe, expect, it } from 'vitest';
import {
  appendAuditEvent,
  verifyAuditChain,
  type ScholarshipAuditEvent,
  type ScholarshipAuditEventInput,
} from '@/src/features/scholarships/audit';
import {
  createCorrectionErasureRequest,
  createDataAccessRequest,
  decideCorrectionErasure,
  isExportAuthorized,
  isExportExpired,
  isExportReady,
  redactPersonalDataExport,
} from '@/src/features/scholarships/privacy';
import {
  buildAuditExportPackage,
  createAuditExportRequest,
  isAuditExportAuthorized,
  isAuditExportExpired,
} from '@/src/features/scholarships/audit-export';

const readInput: ScholarshipAuditEventInput = {
  actor: 'reviewer-1',
  action: 'application.read',
  resource: 'application',
  resourceId: 'application-1',
  outcome: 'success',
  requestId: 'request-1',
  occurredAt: '2026-09-24T10:00:00.000Z',
  changeMetadata: { changedFields: [], summary: 'Application viewed' },
};

describe('immutable scholarship audit trail (#1156)', () => {
  it('chains events and verifies an untouched trail', () => {
    const first = appendAuditEvent(undefined, readInput);
    const second = appendAuditEvent(first, {
      ...readInput,
      action: 'decision.recorded',
      occurredAt: '2026-09-24T10:05:00.000Z',
      changeMetadata: { changedFields: ['status'], summary: 'Decision recorded' },
    });

    expect(first.sequence).toBe(1);
    expect(second.previousHash).toBe(first.hash);
    expect(verifyAuditChain([first, second])).toEqual({ valid: true });
  });

  it('detects tampering with a stored event', () => {
    const first = appendAuditEvent(undefined, readInput);
    const tampered: ScholarshipAuditEvent = { ...first, outcome: 'denied' };

    const result = verifyAuditChain([tampered]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(first.id);
  });
});

describe('applicant data access and correction/erasure (#1154, #1155)', () => {
  it('expires exports and authorizes only the applicant', () => {
    const request = createDataAccessRequest('applicant-1', 'json');

    expect(isExportExpired(request)).toBe(false);
    expect(isExportAuthorized(request, 'applicant-1')).toBe(true);
    expect(isExportAuthorized(request, 'applicant-2')).toBe(false);

    const afterExpiry = new Date(Date.parse(request.expiresAt) + 1);
    expect(isExportExpired(request, afterExpiry)).toBe(true);
    expect(isExportReady({ ...request, status: 'ready' }, afterExpiry)).toBe(false);
  });

  it('excludes other users private notes from exports', () => {
    const redacted = redactPersonalDataExport({
      applicantId: 'applicant-1',
      reviewerNotes: 'private reviewer note',
      status: 'approved',
    });

    expect(redacted).not.toHaveProperty('reviewerNotes');
    expect(redacted.status).toBe('approved');
  });

  it('preserves lawful records on erasure and records denial reasons', () => {
    const erasure = decideCorrectionErasure(
      createCorrectionErasureRequest('applicant-1', 'erasure'),
      { status: 'completed' }
    );
    expect(erasure.status).toBe('completed');
    expect(erasure.preservedRecords).toContain('audit-event');
    expect(erasure.preservedRecords).toContain('payment');

    const denied = decideCorrectionErasure(
      createCorrectionErasureRequest('applicant-1', 'correction'),
      { status: 'denied', denialReason: 'Outside the correction window' }
    );
    expect(denied.denialReason).toBe('Outside the correction window');
  });
});

describe('sponsor and regulator audit exports (#1157)', () => {
  const events = [
    appendAuditEvent(undefined, readInput),
    appendAuditEvent(undefined, {
      ...readInput,
      action: 'program.published',
      resource: 'program',
      resourceId: 'program-1',
      occurredAt: '2026-09-24T11:00:00.000Z',
    }),
    appendAuditEvent(undefined, {
      ...readInput,
      resourceId: 'application-2',
      occurredAt: '2026-09-24T12:00:00.000Z',
    }),
  ];

  const request = createAuditExportRequest({
    audience: 'regulator',
    scope: { programId: 'program-1', from: '2026-09-24T00:00:00.000Z', to: '2026-09-25T00:00:00.000Z' },
    requestedBy: 'regulator-1',
  });

  it('requires strong authorization per audience', () => {
    expect(isAuditExportAuthorized('regulator', 'regulator')).toBe(true);
    expect(isAuditExportAuthorized('regulator', 'sponsor-admin')).toBe(false);
    expect(isAuditExportAuthorized('sponsor', 'sponsor-admin')).toBe(true);
  });

  it('scopes records, redacts unrelated applicants, and expires', () => {
    const pkg = buildAuditExportPackage(
      events,
      request,
      ['application-1'],
      ['application-1', 'application-2']
    );

    expect(pkg.redactedApplicantIds).toEqual(['application-2']);
    expect(pkg.records.some((record) => record.resourceId === 'application-2')).toBe(false);
    expect(pkg.records.some((record) => record.action === 'program.published')).toBe(true);
    expect(isAuditExportExpired(pkg)).toBe(false);

    const afterExpiry = new Date(Date.parse(pkg.expiresAt) + 1);
    expect(isAuditExportExpired(pkg, afterExpiry)).toBe(true);
  });

  it('produces a deterministic integrity hash', () => {
    const first = buildAuditExportPackage(events, request, ['application-1'], ['application-1']);
    const second = buildAuditExportPackage(events, request, ['application-1'], ['application-1']);

    expect(first.integrityHash).toBe(second.integrityHash);
  });
});
