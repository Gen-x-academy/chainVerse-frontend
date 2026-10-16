/**
 * Mentor identity verification workflow (closes #1258, MENTOR-011).
 *
 * - **Only authorized reviewers act.** `canReviewVerification` allows a
 *   moderator or administrator, and always refuses self-review.
 * - **Callbacks are replay-safe.** `applyVerificationCallback` ignores a
 *   callback id it has already applied, so a retried webhook is a no-op.
 * - **Expiry removes eligibility.** `evaluateVerification` derives status from
 *   the clock: an approved verification past `expiresAt` is `expired` and not
 *   eligible.
 * - **Privacy is preserved.** No raw document is stored; `discloseVerification`
 *   exposes a boolean, never the provider, evidence, or rejection detail.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  APPROVED_VERIFICATION_PROVIDERS,
  type MentorVerification,
  type VerificationDisclosure,
  type VerificationError,
  type VerificationErrorCode,
  type VerificationProvider,
  type VerificationReviewerRole,
  type VerificationStatus,
} from './types';

/** Default approval lifetime when a provider does not set one. */
export const VERIFICATION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const RAW_DOCUMENT_KEY = /^(?:document|rawDoc|passportScan|idImage|attachment|file)$/i;
const RAW_DOCUMENT_VALUE = /^(?:data:|https?:\/\/\S+\.(?:pdf|png|jpe?g)$)/i;

function fail(code: VerificationErrorCode, message: string): VerificationError {
  return { code, message };
}

/** True when a value looks like a raw document rather than an opaque reference. */
export function looksLikeRawDocument(value: string): boolean {
  return RAW_DOCUMENT_VALUE.test(value.trim());
}

/** Payload keys that must never be persisted; used by the submit endpoint. */
export function prohibitedDocumentKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => RAW_DOCUMENT_KEY.test(key));
}

export function isVerificationExpired(
  verification: MentorVerification,
  now: Date = new Date(),
): boolean {
  if (!verification.expiresAt) return false;
  const expiry = Date.parse(verification.expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry <= now.getTime();
}

/**
 * Derives the effective status from the stored record and the clock. A
 * `verified` record past its expiry becomes `expired`, which removes
 * eligibility.
 */
export function evaluateVerification(
  verification: MentorVerification,
  now: Date = new Date(),
): VerificationStatus {
  if (
    verification.status === 'verified' &&
    isVerificationExpired(verification, now)
  ) {
    return 'expired';
  }
  return verification.status;
}

export function isMentorEligible(
  verification: MentorVerification,
  now: Date = new Date(),
): boolean {
  return evaluateVerification(verification, now) === 'verified';
}

/** Validates a submission before it is sent. */
export function validateVerificationSubmission(
  verification: MentorVerification,
): VerificationError[] {
  const errors: VerificationError[] = [];

  if (!APPROVED_VERIFICATION_PROVIDERS.includes(verification.provider)) {
    errors.push(fail('UNKNOWN_PROVIDER', 'Choose an approved verification provider.'));
  }
  if (!verification.consentGivenAt) {
    errors.push(fail('CONSENT_REQUIRED', 'Consent is required before verification.'));
  }
  if (verification.evidenceRef && looksLikeRawDocument(verification.evidenceRef)) {
    errors.push(fail('RAW_DOCUMENT_PROHIBITED', 'Store an evidence reference, never the document itself.'));
  }
  if (!verification.evidenceRef) {
    errors.push(fail('MISSING_EVIDENCE_REF', 'An evidence reference is required.'));
  }

  return errors;
}

// ─── Review authorization ─────────────────────────────────────────────────────

export type VerificationReviewer = {
  userId: string;
  role: VerificationReviewerRole;
};

/**
 * Only a moderator or administrator may review, and never their own
 * verification. Returns the denial reason, or `undefined` when allowed.
 */
export function canReviewVerification(
  reviewer: VerificationReviewer,
  verification: MentorVerification,
): VerificationError | undefined {
  if (reviewer.role !== 'moderator' && reviewer.role !== 'administrator') {
    return fail('NOT_AUTHORIZED_REVIEWER', 'Only a moderator or administrator may review verifications.');
  }
  if (reviewer.userId === verification.mentorId) {
    return fail('SELF_REVIEW_PROHIBITED', 'You cannot review your own verification.');
  }
  return undefined;
}

// ─── Replay-safe callback ─────────────────────────────────────────────────────

export type VerificationCallback = {
  /** Idempotency key supplied by the provider. */
  callbackId: string;
  decision: 'approve' | 'reject';
  reviewerId?: string;
  rejectionReason?: string;
  expiresAt?: string;
  receivedAt: string;
};

/**
 * Applies a provider callback once. A replayed `callbackId` returns the record
 * unchanged, so a retried webhook never produces a second effect.
 */
export function applyVerificationCallback(
  verification: MentorVerification,
  callback: VerificationCallback,
): MentorVerification {
  const processed = verification.processedCallbackIds ?? [];
  if (processed.includes(callback.callbackId)) return verification;

  const approved = callback.decision === 'approve';
  const expiresAt = approved
    ? callback.expiresAt ??
      new Date(Date.parse(callback.receivedAt) + VERIFICATION_TTL_MS).toISOString()
    : undefined;

  return {
    ...verification,
    status: approved ? 'verified' : 'rejected',
    reviewedAt: callback.receivedAt,
    reviewerId: callback.reviewerId ?? verification.reviewerId,
    rejectionReason: approved ? undefined : callback.rejectionReason ?? 'Verification was rejected.',
    expiresAt,
    processedCallbackIds: [...processed, callback.callbackId],
  };
}

/** Starts a fresh attempt, keeping a privacy-preserving rejection history out. */
export function startReverification(
  verification: MentorVerification,
  now: Date = new Date(),
): MentorVerification {
  return {
    ...verification,
    status: 'pending',
    submittedAt: now.toISOString(),
    reviewedAt: undefined,
    reviewerId: undefined,
    rejectionReason: undefined,
    expiresAt: undefined,
    attempts: verification.attempts + 1,
  };
}

// ─── Disclosure ───────────────────────────────────────────────────────────────

/** The public view: a boolean and an expiry, never the private detail. */
export function discloseVerification(
  verification: MentorVerification,
  now: Date = new Date(),
): VerificationDisclosure {
  const status = evaluateVerification(verification, now);
  return {
    mentorId: verification.mentorId,
    status,
    eligible: status === 'verified',
    ...(verification.expiresAt ? { expiresAt: verification.expiresAt } : {}),
    reverificationRequired: status === 'expired' || status === 'rejected',
  };
}

const VERIFICATION_PATH = '/mentorship/verifications';

export const mentorshipVerificationService = {
  get: (mentorId: string): Promise<MentorVerification> =>
    apiClient.get<MentorVerification>(`${VERIFICATION_PATH}/${encodeURIComponent(mentorId)}`),

  submit: (mentorId: string, body: { provider: VerificationProvider; consentGivenAt: string; evidenceRef: string }): Promise<MentorVerification> =>
    apiClient.post<MentorVerification>(`${VERIFICATION_PATH}/${encodeURIComponent(mentorId)}`, body),

  review: (
    mentorId: string,
    body: { decision: 'approve' | 'reject'; rejectionReason?: string },
  ): Promise<MentorVerification> =>
    apiClient.post<MentorVerification>(
      `${VERIFICATION_PATH}/${encodeURIComponent(mentorId)}/review`,
      body,
    ),
};
