/**
 * Mentor identity verification types (closes #1258, MENTOR-011, Identity track).
 *
 * Verification tracks provider references, consent, review status, expiry,
 * rejection reason, and re-verification. Raw identity documents are never
 * stored — only an opaque evidence reference — and an expired verification
 * removes eligibility even if it was once approved.
 */

export type VerificationProvider =
  | 'government-id'
  | 'professional-body'
  | 'institution-registry'
  | 'manual-review';

export const APPROVED_VERIFICATION_PROVIDERS: readonly VerificationProvider[] = [
  'government-id',
  'professional-body',
  'institution-registry',
  'manual-review',
];

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'expired';

export type VerificationReviewerRole = 'moderator' | 'administrator';

export type MentorVerification = {
  id: string;
  mentorId: string;
  provider: VerificationProvider;
  status: VerificationStatus;
  /** ISO timestamp the mentor consented to verification; required to submit. */
  consentGivenAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerId?: string;
  /** Set when `status` becomes `rejected`; shown to the mentor. */
  rejectionReason?: string;
  /** ISO expiry of an approved verification. */
  expiresAt?: string;
  /** Opaque reference to provider evidence — never a raw document. */
  evidenceRef?: string;
  /** Number of re-verification attempts; unbounded attempts are rate-limited server-side. */
  attempts: number;
  /** Idempotency keys already applied, so a replayed callback is ignored. */
  processedCallbackIds?: string[];
};

export type VerificationErrorCode =
  | 'UNKNOWN_PROVIDER'
  | 'CONSENT_REQUIRED'
  | 'RAW_DOCUMENT_PROHIBITED'
  | 'MISSING_EVIDENCE_REF'
  | 'NOT_AUTHORIZED_REVIEWER'
  | 'SELF_REVIEW_PROHIBITED';

export type VerificationError = {
  code: VerificationErrorCode;
  message: string;
};

/** The public, privacy-preserving view of a verification. */
export type VerificationDisclosure = {
  mentorId: string;
  status: VerificationStatus;
  /** A boolean only — never the provider, evidence, or rejection detail. */
  eligible: boolean;
  expiresAt?: string;
  /** Whether the mentor should be prompted to re-verify. */
  reverificationRequired: boolean;
};
