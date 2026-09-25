import { describe, expect, it } from 'vitest';
import {
  assertNoProviderSecrets,
  evaluateVerification,
  isClaimExpired,
  validateIdentityClaim,
  type IdentityClaim,
} from '@/src/features/scholarships/identity';

const now = new Date('2026-09-24T12:00:00.000Z');

const identityClaim: IdentityClaim = {
  id: 'claim-identity-1',
  provider: 'government-id',
  issuer: 'national-id-authority',
  subjectId: 'student-1',
  claimType: 'identity',
  issuedAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2027-09-01T00:00:00.000Z',
  evidenceRef: 'evidence:identity:student-1',
};

const enrollmentClaim: IdentityClaim = {
  id: 'claim-enrollment-1',
  provider: 'institution-registry',
  issuer: 'university-registrar',
  subjectId: 'student-1',
  claimType: 'enrollment',
  issuedAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-11-01T00:00:00.000Z',
  evidenceRef: 'evidence:enrollment:student-1',
};

describe('verified student identity and enrollment (#1148)', () => {
  it('accepts well-formed claims from approved issuers', () => {
    expect(validateIdentityClaim(identityClaim, now)).toEqual([]);
    expect(validateIdentityClaim(enrollmentClaim, now)).toEqual([]);
  });

  it('rejects a claim whose issuer is out of scope for the provider', () => {
    const errors = validateIdentityClaim(
      { ...identityClaim, issuer: 'university-registrar' },
      now
    );

    expect(errors).toContain('ISSUER_SCOPE_MISMATCH');
  });

  it('rejects an unknown provider and an over-long enrollment claim', () => {
    const unknownProvider = {
      ...identityClaim,
      provider: 'office-365' as unknown as IdentityClaim['provider'],
    };
    expect(validateIdentityClaim(unknownProvider, now)).toContain('UNKNOWN_PROVIDER');

    expect(
      validateIdentityClaim({ ...identityClaim, provider: 'email-domain', issuer: 'student-domain-issuer' }, now)
    ).toEqual([]);

    const tooLong = validateIdentityClaim(
      { ...enrollmentClaim, expiresAt: '2027-09-01T00:00:00.000Z' },
      now
    );
    expect(tooLong).toContain('CLAIM_TTL_TOO_LONG');
  });

  it('expires claims and never stores a raw provider secret', () => {
    const expired = { ...identityClaim, expiresAt: '2026-09-10T00:00:00.000Z' };
    expect(isClaimExpired(expired, now)).toBe(true);
    expect(validateIdentityClaim(expired, now)).toContain('EXPIRED_CLAIM');

    const leaky = { ...identityClaim, evidenceRef: 'client_secret=abc123' };
    expect(validateIdentityClaim(leaky, now)).toContain('RAW_PROVIDER_SECRET');
  });

  it('verifies only when both identity and enrollment are valid', () => {
    expect(evaluateVerification('student-1', [identityClaim, enrollmentClaim], now)).toMatchObject({
      status: 'verified',
      requiresFallbackReview: false,
    });

    expect(evaluateVerification('student-1', [identityClaim], now)).toMatchObject({
      status: 'needs-review',
      requiresFallbackReview: true,
    });

    const stale = { ...enrollmentClaim, expiresAt: '2026-09-10T00:00:00.000Z' };
    expect(evaluateVerification('student-1', [identityClaim, stale], now).status).toBe('needs-review');
    expect(evaluateVerification('student-1', [], now).status).toBe('unverified');
  });

  it('flags payload keys that would persist provider secrets', () => {
    expect(
      assertNoProviderSecrets({ subjectId: 'student-1', apiKey: 'x', privateKey: 'y', note: 'ok' })
    ).toEqual(['apiKey', 'privateKey']);
  });
});
