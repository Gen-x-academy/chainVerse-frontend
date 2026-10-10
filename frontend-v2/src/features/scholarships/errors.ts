/**
 * Typed Scholarship API Error Adapter (Issue #1226).
 *
 * Normalizes backend error responses across applications, awards, milestones,
 * and disbursements into stable, machine-readable error codes and sanitized,
 * user-safe messages.
 *
 * Invariants:
 * 1. UI components must never branch on English message strings; all decisions
 *    branch strictly on `code` or helper predicates.
 * 2. Sensitive server details (stack traces, SQL messages, internal IP addresses)
 *    are never exposed to the user.
 * 3. Request/Trace IDs are preserved for customer support and observability.
 * 4. Unknown or non-standard errors degrade gracefully into a safe, consistent representation.
 */

import { ScholarshipApiError } from './services/scholarship-api';

export type ScholarshipErrorCode =
  // Transport & Authentication
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'TENANT_MISMATCH'
  | 'REVIEWER_CONFLICT'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'UPSTREAM_UNAVAILABLE'
  // Applications
  | 'APPLICATION_NOT_FOUND'
  | 'APPLICATION_DUPLICATE'
  | 'APPLICATION_DEADLINE_EXPIRED'
  | 'APPLICATION_ROUND_CLOSED'
  | 'APPLICATION_INVALID_STATE'
  | 'STATEMENT_REQUIRED'
  | 'AID_ELIGIBILITY_FAILED'
  // Awards & Agreements
  | 'AWARD_NOT_FOUND'
  | 'AWARD_ALREADY_ACCEPTED'
  | 'AWARD_ALREADY_DECLINED'
  | 'AWARD_ACCEPTANCE_DEADLINE_EXPIRED'
  | 'AWARD_AGREEMENT_VERSION_MISMATCH'
  | 'AWARD_DECLARATIONS_INCOMPLETE'
  | 'AWARD_CANCELLED'
  // Milestones & Disbursements
  | 'MILESTONE_NOT_FOUND'
  | 'MILESTONE_ORDER_VIOLATION'
  | 'MILESTONE_ALREADY_APPROVED'
  | 'DISBURSEMENT_NOT_FOUND'
  | 'DISBURSEMENT_ALREADY_PROCESSED'
  | 'FUNDING_POOL_EXHAUSTED'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'AMOUNT_ABOVE_MAXIMUM'
  | 'IDEMPOTENCY_CONFLICT'
  | 'LEDGER_DESYNCHRONIZATION'
  // Concurrency & Fallbacks
  | 'CONCURRENT_MODIFICATION'
  | 'UNKNOWN_ERROR';

export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'concurrency'
  | 'tenancy'
  | 'server'
  | 'network'
  | 'unknown';

export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface NormalizedScholarshipError {
  readonly name: 'NormalizedScholarshipError';
  readonly code: ScholarshipErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly requestId?: string;
  readonly fieldErrors: ReadonlyArray<FieldError>;
  readonly isRetryable: boolean;
  readonly category: ErrorCategory;
  readonly originalError?: unknown;
}

/**
 * Standardized user-facing messages indexed by stable error code.
 * Free of sensitive internal details.
 */
const SAFE_USER_MESSAGES: Record<ScholarshipErrorCode, string> = {
  UNAUTHENTICATED: 'Your session has expired. Please sign in again to continue.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  TENANT_MISMATCH: 'You do not have access to records in this organization.',
  REVIEWER_CONFLICT: 'You cannot review applications for a round where you are a participant.',
  NOT_FOUND: 'The requested scholarship resource could not be found.',
  VALIDATION_ERROR: 'One or more fields in your submission are invalid. Please check the form.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  INTERNAL_SERVER_ERROR: 'A temporary server error occurred. Our team has been notified.',
  UPSTREAM_UNAVAILABLE: 'A dependent service is temporarily unavailable. Please try again later.',

  APPLICATION_NOT_FOUND: 'The specified scholarship application could not be found.',
  APPLICATION_DUPLICATE: 'You have already submitted an application for this scholarship round.',
  APPLICATION_DEADLINE_EXPIRED: 'The deadline for this scholarship round has passed.',
  APPLICATION_ROUND_CLOSED: 'This scholarship round is currently closed to new applications.',
  APPLICATION_INVALID_STATE: 'The application is not in a valid state for this action.',
  STATEMENT_REQUIRED: 'A personal statement is required to complete your application.',
  AID_ELIGIBILITY_FAILED: 'This application does not meet the necessary financial aid criteria.',

  AWARD_NOT_FOUND: 'The requested award record could not be found.',
  AWARD_ALREADY_ACCEPTED: 'This scholarship award has already been accepted.',
  AWARD_ALREADY_DECLINED: 'This scholarship award has already been declined.',
  AWARD_ACCEPTANCE_DEADLINE_EXPIRED: 'The acceptance window for this award offer has expired.',
  AWARD_AGREEMENT_VERSION_MISMATCH: 'The terms of agreement have been updated. Please review the current version.',
  AWARD_DECLARATIONS_INCOMPLETE: 'All required declarations must be acknowledged to accept this award.',
  AWARD_CANCELLED: 'This scholarship award has been cancelled or terminated.',

  MILESTONE_NOT_FOUND: 'The requested milestone could not be found.',
  MILESTONE_ORDER_VIOLATION: 'Previous milestones must be completed and approved before submitting this milestone.',
  MILESTONE_ALREADY_APPROVED: 'This milestone has already been approved.',
  DISBURSEMENT_NOT_FOUND: 'The requested disbursement record could not be found.',
  DISBURSEMENT_ALREADY_PROCESSED: 'This disbursement has already been processed and cannot be repeated.',
  FUNDING_POOL_EXHAUSTED: 'The funding pool for this round has insufficient remaining funds.',
  AMOUNT_BELOW_MINIMUM: 'The requested amount is below the minimum allowed award limit.',
  AMOUNT_ABOVE_MAXIMUM: 'The requested amount exceeds the maximum allowable award for this round.',
  IDEMPOTENCY_CONFLICT: 'A request with this transaction token has already been submitted.',
  LEDGER_DESYNCHRONIZATION: 'Payment ledger is momentarily synchronizing. Please try again shortly.',

  CONCURRENT_MODIFICATION: 'This record was modified by another user or session. Please refresh and retry.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
};

/**
 * Mapping table from raw backend strings / symbols to normalized error codes.
 */
const BACKEND_CODE_MAP: Record<string, ScholarshipErrorCode> = {
  // Direct matching
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'UNAUTHORIZED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  REVIEWER_CONFLICT: 'REVIEWER_CONFLICT',
  CONFLICT_OF_INTEREST: 'REVIEWER_CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  SERVICE_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',

  // Application codes
  APPLICATION_NOT_FOUND: 'APPLICATION_NOT_FOUND',
  APPLICATION_DUPLICATE: 'APPLICATION_DUPLICATE',
  DUPLICATE_APPLICATION: 'APPLICATION_DUPLICATE',
  DEADLINE_EXPIRED: 'APPLICATION_DEADLINE_EXPIRED',
  APPLICATION_DEADLINE_EXPIRED: 'APPLICATION_DEADLINE_EXPIRED',
  ROUND_CLOSED: 'APPLICATION_ROUND_CLOSED',
  APPLICATION_ROUND_CLOSED: 'APPLICATION_ROUND_CLOSED',
  INVALID_APPLICATION_STATE: 'APPLICATION_INVALID_STATE',
  ILLEGAL_TRANSITION: 'APPLICATION_INVALID_STATE',
  STATEMENT_REQUIRED: 'STATEMENT_REQUIRED',
  AID_ELIGIBILITY_FAILED: 'AID_ELIGIBILITY_FAILED',

  // Award codes
  AWARD_NOT_FOUND: 'AWARD_NOT_FOUND',
  AWARD_ALREADY_ACCEPTED: 'AWARD_ALREADY_ACCEPTED',
  AWARD_ALREADY_DECLINED: 'AWARD_ALREADY_DECLINED',
  ACCEPTANCE_DEADLINE_PASSED: 'AWARD_ACCEPTANCE_DEADLINE_EXPIRED',
  AWARD_ACCEPTANCE_DEADLINE_EXPIRED: 'AWARD_ACCEPTANCE_DEADLINE_EXPIRED',
  AGREEMENT_VERSION_MISMATCH: 'AWARD_AGREEMENT_VERSION_MISMATCH',
  DECLARATIONS_INCOMPLETE: 'AWARD_DECLARATIONS_INCOMPLETE',
  AWARD_CANCELLED: 'AWARD_CANCELLED',
  AWARD_TERMINATED: 'AWARD_CANCELLED',

  // Milestone / Disbursement codes
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  MILESTONE_ORDER_VIOLATION: 'MILESTONE_ORDER_VIOLATION',
  MILESTONE_ALREADY_APPROVED: 'MILESTONE_ALREADY_APPROVED',
  DISBURSEMENT_NOT_FOUND: 'DISBURSEMENT_NOT_FOUND',
  DISBURSEMENT_ALREADY_PROCESSED: 'DISBURSEMENT_ALREADY_PROCESSED',
  FUNDING_POOL_EXHAUSTED: 'FUNDING_POOL_EXHAUSTED',
  INSUFFICIENT_POOL: 'FUNDING_POOL_EXHAUSTED',
  FUNDING_SHORTFALL: 'FUNDING_POOL_EXHAUSTED',
  AMOUNT_BELOW_MINIMUM: 'AMOUNT_BELOW_MINIMUM',
  AMOUNT_ABOVE_MAXIMUM: 'AMOUNT_ABOVE_MAXIMUM',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  LEDGER_DESYNCHRONIZATION: 'LEDGER_DESYNCHRONIZATION',
  LEDGER_FAILURE: 'LEDGER_DESYNCHRONIZATION',

  // Concurrency
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  OPTIMISTIC_LOCK_ERROR: 'CONCURRENT_MODIFICATION',
};

function categorize(code: ScholarshipErrorCode): ErrorCategory {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'authentication';
    case 'UNAUTHORIZED':
    case 'REVIEWER_CONFLICT':
      return 'authorization';
    case 'TENANT_MISMATCH':
      return 'tenancy';
    case 'VALIDATION_ERROR':
    case 'STATEMENT_REQUIRED':
    case 'AID_ELIGIBILITY_FAILED':
    case 'AMOUNT_BELOW_MINIMUM':
    case 'AMOUNT_ABOVE_MAXIMUM':
    case 'AWARD_DECLARATIONS_INCOMPLETE':
      return 'validation';
    case 'NOT_FOUND':
    case 'APPLICATION_NOT_FOUND':
    case 'AWARD_NOT_FOUND':
    case 'MILESTONE_NOT_FOUND':
    case 'DISBURSEMENT_NOT_FOUND':
      return 'not_found';
    case 'APPLICATION_DUPLICATE':
    case 'APPLICATION_DEADLINE_EXPIRED':
    case 'APPLICATION_ROUND_CLOSED':
    case 'AWARD_ALREADY_ACCEPTED':
    case 'AWARD_ALREADY_DECLINED':
    case 'AWARD_ACCEPTANCE_DEADLINE_EXPIRED':
    case 'AWARD_AGREEMENT_VERSION_MISMATCH':
    case 'AWARD_CANCELLED':
    case 'MILESTONE_ORDER_VIOLATION':
    case 'MILESTONE_ALREADY_APPROVED':
    case 'DISBURSEMENT_ALREADY_PROCESSED':
    case 'FUNDING_POOL_EXHAUSTED':
    case 'IDEMPOTENCY_CONFLICT':
      return 'conflict';
    case 'CONCURRENT_MODIFICATION':
      return 'concurrency';
    case 'INTERNAL_SERVER_ERROR':
    case 'UPSTREAM_UNAVAILABLE':
    case 'LEDGER_DESYNCHRONIZATION':
      return 'server';
    case 'NETWORK_ERROR':
    case 'RATE_LIMITED':
      return 'network';
    default:
      return 'unknown';
  }
}

function determineRetryable(code: ScholarshipErrorCode, status: number): boolean {
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (code === 'RATE_LIMITED' || code === 'UPSTREAM_UNAVAILABLE' || code === 'LEDGER_DESYNCHRONIZATION' || code === 'NETWORK_ERROR') return true;
  return false;
}

/**
 * Checks if raw server details (stack traces, SQL errors, internal IPs) are in the string.
 */
function isSensitiveDetail(text: string): boolean {
  return /error:|stack|at\s+[\w./\\-]+:\d+:\d+|sql|database|table|column|syntax error|econnrefused|password|secret|bearer/i.test(text);
}

/**
 * Adapts an arbitrary error into a normalized, strongly typed `NormalizedScholarshipError`.
 */
export function normalizeScholarshipError(
  rawError: unknown,
  fallbackMessage?: string,
): NormalizedScholarshipError {
  if (
    rawError &&
    typeof rawError === 'object' &&
    'name' in rawError &&
    (rawError as { name: string }).name === 'NormalizedScholarshipError'
  ) {
    return rawError as NormalizedScholarshipError;
  }

  let status = 0;
  let rawCode: string | undefined;
  let requestId: string | undefined;
  let extractedFieldErrors: FieldError[] = [];
  let userMessageOverride: string | undefined;

  if (rawError instanceof ScholarshipApiError) {
    status = rawError.status;
    const bodyText = rawError.message;

    // Attempt to parse JSON response body
    if (bodyText && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed && typeof parsed === 'object') {
          rawCode = parsed.code || parsed.errorCode || parsed.error;
          requestId = parsed.requestId || parsed.request_id || parsed.traceId || parsed.correlationId;

          if (Array.isArray(parsed.fieldErrors)) {
            extractedFieldErrors = parsed.fieldErrors.map((fe: any) => ({
              field: String(fe.field ?? ''),
              code: String(fe.code ?? 'INVALID'),
              message: String(fe.message ?? 'Invalid value'),
            }));
          } else if (Array.isArray(parsed.errors)) {
            extractedFieldErrors = parsed.errors.map((fe: any) => ({
              field: String(fe.field ?? fe.path ?? ''),
              code: String(fe.code ?? 'INVALID'),
              message: String(fe.message ?? 'Invalid value'),
            }));
          } else if (Array.isArray(parsed.message)) {
            // NestJS class-validator array of validation messages
            extractedFieldErrors = parsed.message.map((msg: string, idx: number) => ({
              field: `field_${idx}`,
              code: 'VALIDATION_ERROR',
              message: String(msg),
            }));
          }

          if (typeof parsed.userMessage === 'string' && !isSensitiveDetail(parsed.userMessage)) {
            userMessageOverride = parsed.userMessage;
          }
        }
      } catch {
        // Body was not valid JSON
      }
    }
  } else if (rawError && typeof rawError === 'object') {
    const obj = rawError as Record<string, unknown>;
    if (typeof obj.status === 'number') status = obj.status;
    if (typeof obj.statusCode === 'number') status = obj.statusCode;
    if (typeof obj.code === 'string') rawCode = obj.code;
    if (typeof obj.requestId === 'string') requestId = obj.requestId;
    if (typeof obj.traceId === 'string') requestId = obj.traceId;

    if (Array.isArray(obj.fieldErrors)) {
      extractedFieldErrors = obj.fieldErrors.map((fe: any) => ({
        field: String(fe.field ?? ''),
        code: String(fe.code ?? 'INVALID'),
        message: String(fe.message ?? 'Invalid value'),
      }));
    }
  } else if (typeof rawError === 'string') {
    if (rawError.includes('AbortError') || rawError.includes('NetworkError') || rawError.includes('Failed to fetch')) {
      rawCode = 'NETWORK_ERROR';
    }
  }

  // Determine normalized code
  let normalizedCode: ScholarshipErrorCode = 'UNKNOWN_ERROR';

  if (rawCode && BACKEND_CODE_MAP[rawCode.toUpperCase()]) {
    normalizedCode = BACKEND_CODE_MAP[rawCode.toUpperCase()];
  } else if (status === 401) {
    normalizedCode = 'UNAUTHENTICATED';
  } else if (status === 403) {
    normalizedCode = 'UNAUTHORIZED';
  } else if (status === 404) {
    normalizedCode = 'NOT_FOUND';
  } else if (status === 409) {
    normalizedCode = 'CONCURRENT_MODIFICATION';
  } else if (status === 422 || status === 400) {
    normalizedCode = 'VALIDATION_ERROR';
  } else if (status === 429) {
    normalizedCode = 'RATE_LIMITED';
  } else if (status === 502 || status === 503 || status === 504) {
    normalizedCode = 'UPSTREAM_UNAVAILABLE';
  } else if (status >= 500) {
    normalizedCode = 'INTERNAL_SERVER_ERROR';
  } else if (rawError instanceof TypeError && (rawError.message.includes('fetch') || rawError.message.includes('network'))) {
    normalizedCode = 'NETWORK_ERROR';
  }

  const category = categorize(normalizedCode);
  const isRetryable = determineRetryable(normalizedCode, status);
  const userMessage = userMessageOverride || SAFE_USER_MESSAGES[normalizedCode] || fallbackMessage || SAFE_USER_MESSAGES.UNKNOWN_ERROR;

  return {
    name: 'NormalizedScholarshipError',
    code: normalizedCode,
    status,
    userMessage,
    requestId,
    fieldErrors: Object.freeze(extractedFieldErrors),
    isRetryable,
    category,
    originalError: rawError,
  };
}

/**
 * Predicate helpers to allow UI and domain logic to branch without inspecting English strings.
 */
export function isScholarshipError(err: unknown): err is NormalizedScholarshipError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'NormalizedScholarshipError'
  );
}

export function isScholarshipErrorCode(
  err: unknown,
  code: ScholarshipErrorCode,
): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return normalized.code === code;
}

export function isAuthError(err: unknown): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return normalized.category === 'authentication' || normalized.category === 'authorization';
}

export function isTenancyError(err: unknown): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return normalized.category === 'tenancy' || normalized.code === 'TENANT_MISMATCH';
}

export function isConcurrencyError(err: unknown): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return (
    normalized.category === 'concurrency' ||
    normalized.code === 'CONCURRENT_MODIFICATION' ||
    normalized.code === 'IDEMPOTENCY_CONFLICT' ||
    normalized.status === 409
  );
}

export function isValidationError(err: unknown): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return normalized.category === 'validation';
}

export function isRetryableError(err: unknown): boolean {
  const normalized = isScholarshipError(err) ? err : normalizeScholarshipError(err);
  return normalized.isRetryable;
}
