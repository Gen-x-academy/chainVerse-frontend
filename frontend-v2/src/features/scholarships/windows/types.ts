/**
 * Types and interfaces for Scholarship Program Application Opening and Deadline Windows.
 *
 * Implements deterministic boundary instants, explicit timezones, grace periods,
 * late-submission policies, and deadline modification grandfathering guarantees.
 */

export type WindowStatus =
  | 'UPCOMING'
  | 'OPEN'
  | 'GRACE_PERIOD'
  | 'LATE_WINDOW'
  | 'CLOSED';

export type LateSubmissionPolicy =
  | 'strict_reject'
  | 'allow_with_penalty'
  | 'requires_waiver'
  | 'discretionary_review';

export interface ApplicationWindow {
  id: string;
  programId: string;
  programName?: string;
  roundId?: string;
  name: string;
  description?: string;

  /** Local date string in format YYYY-MM-DD */
  openDate: string;
  /** Local time string in format HH:mm (24h) */
  openTime: string;

  /** Local date string in format YYYY-MM-DD */
  closeDate: string;
  /** Local time string in format HH:mm (24h) */
  closeTime: string;

  /** IANA Timezone identifier e.g. "UTC", "America/New_York", "Africa/Nairobi", "Europe/London" */
  timeZone: string;

  /** Deterministic UTC ISO-8601 boundary timestamp for opening */
  openInstantUtc: string;
  /** Deterministic UTC ISO-8601 boundary timestamp for closing/deadline */
  closeInstantUtc: string;

  /** Grace period in minutes immediately following deadline for in-flight submissions */
  gracePeriodMinutes: number;
  /** Deterministic UTC boundary timestamp for grace period end */
  gracePeriodEndUtc: string;

  /** Late submission handling rule */
  lateSubmissionPolicy: LateSubmissionPolicy;
  /** If late submissions allowed, penalty deduction percentage (e.g. 10%) */
  latePenaltyPercent?: number;
  /** Absolute cutoff instant beyond which no submission is accepted */
  lateSubmissionCutoffUtc?: string;

  /** Version tracking for safe deadline modifications */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type TimingClassification =
  | 'ON_TIME'
  | 'GRACE_PERIOD'
  | 'LATE_ACCEPTED'
  | 'REJECTED_BEFORE_OPEN'
  | 'REJECTED_PAST_DEADLINE'
  | 'REJECTED_LATE_POLICY';

export interface TimingEvaluationResult {
  accepted: boolean;
  classification: TimingClassification;
  reason?: string;
  message: string;
  currentInstantUtc: string;
  closeInstantUtc: string;
  gracePeriodEndUtc: string;
  latencyFromDeadlineMs: number;
}

export interface WindowValidationError {
  field: string;
  code:
    | 'INVALID_DATE_FORMAT'
    | 'INVALID_TIME_FORMAT'
    | 'INVALID_TIMEZONE'
    | 'OPEN_AFTER_CLOSE'
    | 'NEGATIVE_GRACE_PERIOD'
    | 'INVALID_LATE_CUTOFF'
    | 'MISSING_REQUIRED_FIELD';
  message: string;
}

export interface WindowValidationResult {
  valid: boolean;
  errors: WindowValidationError[];
  warnings: string[];
}

export interface SubmittedApplicationRecord {
  id: string;
  programId: string;
  roundId: string;
  studentId: string;
  submittedAtUtc: string;
  receiptId: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
}

export interface DeadlineChangeAssessment {
  isShortened: boolean;
  isExtended: boolean;
  previousCloseUtc: string;
  proposedCloseUtc: string;
  affectedApplicationsCount: number;
  grandfatheredApplicationIds: string[];
  safeToApply: boolean;
  warningMessage?: string;
}

export interface DeadlineChangeAuditRecord {
  id: string;
  windowId: string;
  programId: string;
  changedBy: string;
  changedAtUtc: string;
  previousCloseUtc: string;
  newCloseUtc: string;
  reason: string;
  grandfatheredApplicationCount: number;
}

export interface CreateWindowPayload {
  programId: string;
  programName?: string;
  roundId?: string;
  name: string;
  description?: string;
  openDate: string;
  openTime: string;
  closeDate: string;
  closeTime: string;
  timeZone: string;
  gracePeriodMinutes: number;
  lateSubmissionPolicy: LateSubmissionPolicy;
  latePenaltyPercent?: number;
  lateCutoffDate?: string;
  lateCutoffTime?: string;
}

export interface UpdateWindowPayload extends Partial<CreateWindowPayload> {
  id: string;
  changeReason?: string;
}

export interface WindowQueryParams {
  programId?: string;
  roundId?: string;
  status?: 'all' | WindowStatus;
  search?: string;
}
