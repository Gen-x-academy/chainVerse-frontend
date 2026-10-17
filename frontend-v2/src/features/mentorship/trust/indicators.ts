/**
 * Deterministic trust indicator computation for issue MENTOR-014.
 *
 * Indicators are derived from explicit, opt-in activity counters only. The
 * computation reads neither personal attributes nor protected scoring inputs,
 * every score is capped at 100, and a sparse input set is flagged instead of
 * being completed with invented activity.
 */

import type {
  StudentTrustProfile,
  TrustIndicator,
  TrustIndicatorKey,
} from './types';

export interface TrustActivityInput {
  /** Number of mentorship programs the student completed. */
  completedPrograms?: number;
  /** Number of courses the student completed. */
  completedCourses?: number;
  /** Number of certificates issued to the student. */
  certificatesIssued?: number;
  /** When the profile identity itself was verified. */
  profileVerifiedAt?: string;
  /** Number of responses the student answered. */
  responsesAnswered?: number;
  /** Number of mentorship sessions the student delivered. */
  sessionsDelivered?: number;
  /** Number of safety reports the student helped close. */
  safetyReportsClosed?: number;
}

const DEFAULTS = {
  cappedScore: 100,
};

export function computeTrustIndicators(
  studentId: string,
  input: TrustActivityInput
): StudentTrustProfile {
  const completion = computeCompletion(input);
  const verification = computeVerification(input);
  const response = computeResponse(input);
  const delivery = computeDelivery(input);
  const safety = computeSafety(input);

  const completionPercent = Math.min(
    DEFAULTS.cappedScore,
    completion.score * 10
  );

  return {
    internalId: `trust-profile-${studentId}`,
    publicId: `ment-trust-${studentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
    correlationId: correlationIdFor(studentId),
    studentId,
    completion,
    verification,
    response,
    delivery,
    safety,
    completionPercent,
  };
}

function correlationIdFor(studentId: string): string {
  // Deterministic placeholder: real correlation ids are issued by the API.
  return `corr-${studentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
}

function computeCompletion(input: TrustActivityInput): TrustIndicator {
  const completed = Math.max(0, input.completedPrograms ?? 0);
  const score = Math.min(DEFAULTS.cappedScore, completed * 10);
  return {
    internalId: `trust-indicator-completion-${completed}`,
    publicId: publicId('completion', completed),
    correlationId: correlationId('completion', completed),
    key: 'completion',
    score,
    explanation:
      completed === 0
        ? 'Completion counts the mentorship programs the student completed.'
        : `${completed} completed mentorship program(s) count towards completion.`,
    sourceIds: [`completed-programs-${completed}`],
    sparseData: completed === 0,
  };
}

function computeVerification(input: TrustActivityInput): TrustIndicator {
  const certificates = Math.max(0, input.certificatesIssued ?? 0);
  const verified =
    input.profileVerifiedAt !== undefined && input.profileVerifiedAt !== '';
  const score = certificates === 0 ? 0 : Math.min(100, 40 + certificates * 10);
  return {
    internalId: `trust-indicator-verification-${certificates}`,
    publicId: publicId('verification', certificates),
    correlationId: correlationId('verification', certificates),
    key: 'verification',
    score,
    explanation:
      certificates === 0
        ? 'Verification counts the certificates issued to the student.'
        : `${certificates} certificate(s) back the verification indicator.`,
    sourceIds: [`certificates-${certificates}`, `profile-verified-${verified}`],
    sparseData: certificates === 0 && !verified,
  };
}

function computeResponse(input: TrustActivityInput): TrustIndicator {
  const answered = Math.max(0, input.responsesAnswered ?? 0);
  const score =
    answered === 0 ? 0 : Math.min(100, 20 + answered * 5);
  return {
    internalId: `trust-indicator-response-${answered}`,
    publicId: publicId('response', answered),
    correlationId: correlationId('response', answered),
    key: 'response',
    score,
    explanation:
      answered === 0
        ? 'Response counts the questions the student answered.'
        : `${answered} answered question(s) support the response indicator.`,
    sourceIds: [`responses-${answered}`],
    sparseData: answered === 0,
  };
}

function computeDelivery(input: TrustActivityInput): TrustIndicator {
  const sessions = Math.max(0, input.sessionsDelivered ?? 0);
  const score =
    sessions === 0 ? 0 : Math.min(100, 30 + sessions * 10);
  return {
    internalId: `trust-indicator-delivery-${sessions}`,
    publicId: publicId('delivery', sessions),
    correlationId: correlationId('delivery', sessions),
    key: 'delivery',
    score,
    explanation:
      sessions === 0
        ? 'Delivery counts the sessions the student delivered.'
        : `${sessions} delivered session(s) back the delivery indicator.`,
    sourceIds: [`sessions-${sessions}`],
    sparseData: sessions === 0,
  };
}

function computeSafety(input: TrustActivityInput): TrustIndicator {
  const closed = Math.max(0, input.safetyReportsClosed ?? 0);
  const score = closed >= 3 ? 60 : 0;
  return {
    internalId: `trust-indicator-safety-${closed}`,
    publicId: publicId('safety', closed),
    correlationId: correlationId('safety', closed),
    key: 'safety',
    score,
    explanation:
      closed >= 3
        ? `${closed} closed safety report(s) back the safety indicator.`
        : 'Safety counts the safety reports the student helped close.',
    sourceIds: [`safety-${closed}`],
    sparseData: closed === 0,
  };
}

function publicId(key: TrustIndicatorKey, value: number): string {
  return `ment-${key}-${String(value).padStart(4, '0')}`;
}

function correlationId(key: TrustIndicatorKey, value: number): string {
  return `corr-${key}-${String(value).padStart(4, '0')}`;
}
