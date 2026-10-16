import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_TTL_MS,
  applyVerificationCallback,
  canReviewVerification,
  discloseVerification,
  evaluateVerification,
  isMentorEligible,
  isVerificationExpired,
  looksLikeRawDocument,
  prohibitedDocumentKeys,
  startReverification,
  validateVerificationSubmission,
} from '../verification/service';
import type {
  MentorVerification,
  VerificationCallback,
  VerificationReviewerRole,
} from '../verification/types';

const NOW = new Date('2025-06-01T00:00:00.000Z');

function verification(overrides: Partial<MentorVerification> = {}): MentorVerification {
  return {
    id: 'verification-1',
    mentorId: 'mentor-1',
    provider: 'government-id',
    status: 'pending',
    consentGivenAt: '2025-01-01T00:00:00.000Z',
    submittedAt: '2025-01-01T00:00:00.000Z',
    evidenceRef: 'provider-case-12345',
    attempts: 1,
    ...overrides,
  };
}

describe('raw-document detection', () => {
  it('recognises data URIs and hosted document files', () => {
    expect(looksLikeRawDocument('data:image/png;base64,AAAA')).toBe(true);
    expect(looksLikeRawDocument('https://files.example.com/passport.pdf')).toBe(true);
  });

  it('treats an opaque reference as safe', () => {
    expect(looksLikeRawDocument('provider-case-12345')).toBe(false);
  });

  it('lists prohibited payload keys', () => {
    expect(prohibitedDocumentKeys({ document: 'x', file: 'y', note: 'ok' })).toEqual([
      'document',
      'file',
    ]);
  });
});

describe('expiry and eligibility', () => {
  it('treats a record without an expiry as not expired', () => {
    expect(isVerificationExpired(verification({ status: 'verified' }), NOW)).toBe(false);
  });

  it('treats an approved verification past its expiry as expired and ineligible', () => {
    const expired = verification({ status: 'verified', expiresAt: '2025-05-01T00:00:00.000Z' });
    expect(isVerificationExpired(expired, NOW)).toBe(true);
    expect(evaluateVerification(expired, NOW)).toBe('expired');
    expect(isMentorEligible(expired, NOW)).toBe(false);
  });

  it('keeps a current approval eligible', () => {
    const current = verification({ status: 'verified', expiresAt: '2025-07-01T00:00:00.000Z' });
    expect(evaluateVerification(current, NOW)).toBe('verified');
    expect(isMentorEligible(current, NOW)).toBe(true);
  });
});

describe('validateVerificationSubmission', () => {
  it('accepts a consented submission with an evidence reference', () => {
    expect(validateVerificationSubmission(verification())).toEqual([]);
  });

  it('requires consent', () => {
    const codes = validateVerificationSubmission(verification({ consentGivenAt: undefined })).map(
      (item) => item.code,
    );
    expect(codes).toContain('CONSENT_REQUIRED');
  });

  it('rejects an unknown provider', () => {
    const codes = validateVerificationSubmission(
      verification({ provider: 'selfie' as MentorVerification['provider'] }),
    ).map((item) => item.code);
    expect(codes).toContain('UNKNOWN_PROVIDER');
  });

  it('refuses a raw document and a missing reference', () => {
    expect(
      validateVerificationSubmission(verification({ evidenceRef: 'data:image/png;base64,AAAA' })).map(
        (item) => item.code,
      ),
    ).toContain('RAW_DOCUMENT_PROHIBITED');
    expect(
      validateVerificationSubmission(verification({ evidenceRef: undefined })).map((item) => item.code),
    ).toContain('MISSING_EVIDENCE_REF');
  });
});

describe('canReviewVerification', () => {
  it('allows a moderator to review another mentor', () => {
    expect(
      canReviewVerification({ userId: 'mod-1', role: 'moderator' }, verification()),
    ).toBeUndefined();
  });

  it('refuses a non-reviewer role', () => {
    expect(
      canReviewVerification(
        { userId: 'any', role: 'student' as VerificationReviewerRole },
        verification(),
      )?.code,
    ).toBe('NOT_AUTHORIZED_REVIEWER');
  });

  it('refuses self-review even for an administrator', () => {
    expect(
      canReviewVerification({ userId: 'mentor-1', role: 'administrator' }, verification())?.code,
    ).toBe('SELF_REVIEW_PROHIBITED');
  });
});

describe('applyVerificationCallback', () => {
  const approve: VerificationCallback = {
    callbackId: 'cb-1',
    decision: 'approve',
    reviewerId: 'mod-1',
    receivedAt: '2025-06-01T00:00:00.000Z',
  };

  it('approves and stamps the default expiry', () => {
    const result = applyVerificationCallback(verification(), approve);
    expect(result.status).toBe('verified');
    expect(result.reviewedAt).toBe('2025-06-01T00:00:00.000Z');
    expect(result.expiresAt).toBe(
      new Date(Date.parse(approve.receivedAt) + VERIFICATION_TTL_MS).toISOString(),
    );
    expect(result.processedCallbackIds).toEqual(['cb-1']);
  });

  it('ignores a replayed callback id', () => {
    const once = applyVerificationCallback(verification(), approve);
    const twice = applyVerificationCallback(once, approve);
    expect(twice).toBe(once);
  });

  it('rejects with a reason', () => {
    const result = applyVerificationCallback(verification(), {
      callbackId: 'cb-2',
      decision: 'reject',
      rejectionReason: 'Evidence unreadable',
      receivedAt: '2025-06-01T00:00:00.000Z',
    });
    expect(result.status).toBe('rejected');
    expect(result.rejectionReason).toBe('Evidence unreadable');
    expect(result.expiresAt).toBeUndefined();
  });
});

describe('startReverification', () => {
  it('resets the attempt and increments the counter', () => {
    const rejected = verification({ status: 'rejected', rejectionReason: 'No', attempts: 2 });
    const fresh = startReverification(rejected, NOW);
    expect(fresh.status).toBe('pending');
    expect(fresh.attempts).toBe(3);
    expect(fresh.submittedAt).toBe('2025-06-01T00:00:00.000Z');
    expect(fresh.rejectionReason).toBeUndefined();
    expect(fresh.reviewedAt).toBeUndefined();
  });
});

describe('discloseVerification', () => {
  it('exposes a boolean and an expiry, never the evidence', () => {
    const disclosure = discloseVerification(
      verification({ status: 'verified', expiresAt: '2025-07-01T00:00:00.000Z', evidenceRef: 'secret' }),
      NOW,
    );
    expect(disclosure.eligible).toBe(true);
    expect(disclosure.status).toBe('verified');
    expect(disclosure.expiresAt).toBe('2025-07-01T00:00:00.000Z');
    expect('evidenceRef' in disclosure).toBe(false);
  });

  it('asks an expired or rejected mentor to re-verify', () => {
    expect(
      discloseVerification(verification({ status: 'verified', expiresAt: '2025-05-01T00:00:00.000Z' }), NOW)
        .reverificationRequired,
    ).toBe(true);
    expect(discloseVerification(verification({ status: 'rejected' }), NOW).reverificationRequired).toBe(
      true,
    );
  });
});
