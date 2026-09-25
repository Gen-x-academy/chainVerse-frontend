/**
 * Verified student identity and enrollment (issue #1148).
 *
 * Applicant identity and active enrollment are verified through approved
 * providers. Claims are issuer-scoped (a provider may only be vouched for by
 * its own registered issuers), short-lived, and validated for length so a claim
 * cannot be minted for longer than policy allows. Raw provider secrets are
 * never stored — only a reference to the evidence — and any applicant that
 * cannot be fully verified automatically falls back to human review.
 */

import { apiClient } from '@/src/lib/api-client';

export type IdentityProvider =
  | 'government-id'
  | 'institution-registry'
  | 'email-domain'
  | 'manual-review';

export const APPROVED_IDENTITY_PROVIDERS: IdentityProvider[] = [
  'government-id',
  'institution-registry',
  'email-domain',
  'manual-review',
];

/** Each provider may only be vouched for by its own registered issuers. */
export const APPROVED_PROVIDER_ISSUERS: Record<IdentityProvider, string[]> = {
  'government-id': ['national-id-authority'],
  'institution-registry': ['university-registrar'],
  'email-domain': ['student-domain-issuer'],
  'manual-review': ['platform-verifier'],
};

export type IdentityClaimType = 'identity' | 'enrollment';

export type IdentityClaim = {
  id: string;
  provider: IdentityProvider;
  issuer: string;
  subjectId: string;
  claimType: IdentityClaimType;
  issuedAt: string;
  expiresAt: string;
  /** Reference to the evidence — never a raw provider secret. */
  evidenceRef: string;
};

export const IDENTITY_CLAIM_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const ENROLLMENT_CLAIM_TTL_MS = 120 * 24 * 60 * 60 * 1000;

export type IdentityClaimError =
  | 'UNKNOWN_PROVIDER'
  | 'ISSUER_SCOPE_MISMATCH'
  | 'EXPIRED_CLAIM'
  | 'CLAIM_TTL_TOO_LONG'
  | 'MISSING_EVIDENCE_REF'
  | 'RAW_PROVIDER_SECRET';

const RAW_SECRET_VALUE = /(client[_-]?secret|api[_-]?key|password|bearer\s|private[_-]?key)/i;

export function isClaimExpired(claim: IdentityClaim, now: Date = new Date()): boolean {
  return Date.parse(claim.expiresAt) <= now.getTime();
}

export function validateIdentityClaim(
  claim: IdentityClaim,
  now: Date = new Date()
): IdentityClaimError[] {
  const errors: IdentityClaimError[] = [];

  if (!APPROVED_IDENTITY_PROVIDERS.includes(claim.provider)) {
    errors.push('UNKNOWN_PROVIDER');
  }

  const issuerScope = APPROVED_PROVIDER_ISSUERS[claim.provider] ?? [];
  if (!issuerScope.includes(claim.issuer)) {
    errors.push('ISSUER_SCOPE_MISMATCH');
  }

  if (isClaimExpired(claim, now)) {
    errors.push('EXPIRED_CLAIM');
  }

  const issuedAt = Date.parse(claim.issuedAt);
  const expiresAt = Date.parse(claim.expiresAt);
  const maxTtl = claim.claimType === 'enrollment' ? ENROLLMENT_CLAIM_TTL_MS : IDENTITY_CLAIM_TTL_MS;
  if (!Number.isNaN(issuedAt) && !Number.isNaN(expiresAt) && expiresAt - issuedAt > maxTtl) {
    errors.push('CLAIM_TTL_TOO_LONG');
  }

  if (!claim.evidenceRef.trim()) {
    errors.push('MISSING_EVIDENCE_REF');
  } else if (RAW_SECRET_VALUE.test(claim.evidenceRef)) {
    errors.push('RAW_PROVIDER_SECRET');
  }

  return errors;
}

export type VerificationStatus = 'unverified' | 'verified' | 'needs-review';

export type IdentityVerification = {
  applicantId: string;
  status: VerificationStatus;
  verifiedClaims: IdentityClaim[];
  providers: IdentityProvider[];
  requiresFallbackReview: boolean;
};

export function evaluateVerification(
  applicantId: string,
  claims: IdentityClaim[],
  now: Date = new Date()
): IdentityVerification {
  const verifiedClaims = claims.filter(
    (claim) => validateIdentityClaim(claim, now).length === 0
  );

  const hasIdentity = verifiedClaims.some((claim) => claim.claimType === 'identity');
  const hasEnrollment = verifiedClaims.some((claim) => claim.claimType === 'enrollment');

  const status: VerificationStatus =
    hasIdentity && hasEnrollment ? 'verified' : verifiedClaims.length > 0 ? 'needs-review' : 'unverified';

  return {
    applicantId,
    status,
    verifiedClaims,
    providers: [...new Set(verifiedClaims.map((claim) => claim.provider))],
    requiresFallbackReview: status === 'needs-review',
  };
}

const PROVIDER_SECRET_KEY = /secret|token|api[_-]?key|password|private[_-]?key/i;

/** Returns payload keys that must never be persisted or logged. */
export function assertNoProviderSecrets(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => PROVIDER_SECRET_KEY.test(key));
}

export const scholarshipIdentityService = {
  verification: (applicantId: string): Promise<IdentityVerification> =>
    apiClient.get<IdentityVerification>(`/scholarships/applicants/${applicantId}/identity`),

  submitClaim: (claim: IdentityClaim): Promise<IdentityVerification> =>
    apiClient.post<IdentityVerification>('/scholarships/identity/claims', claim),

  requestFallbackReview: (applicantId: string, note: string): Promise<IdentityVerification> =>
    apiClient.post<IdentityVerification>(`/scholarships/applicants/${applicantId}/identity/review`, {
      note,
    }),
};
