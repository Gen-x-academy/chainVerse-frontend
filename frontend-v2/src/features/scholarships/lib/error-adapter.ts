/**
 * Scholarship API error normalisation (closes #1226).
 *
 * Scholarship services and components previously consumed a mix of thrown
 * message strings and ad hoc response shapes across applications, awards,
 * milestones, and disbursements. This module is the single adapter that turns
 * any failure — a `ScholarshipApiError`, a thrown `Error`, an `ApiError`
 * payload, or an unknown value — into one stable `NormalizedScholarshipError`.
 *
 * Guarantees:
 *
 * - **Stable codes, not English.** UI logic branches on `code`; the human
 *   `message` is display-only and may change without breaking behaviour.
 * - **Field errors are structured.** A validation failure yields
 *   `fieldErrors` keyed by field name so a form can place each message.
 * - **Support can act.** A `requestId` is preserved when the backend supplies
 *   one, and never invented.
 * - **Sensitive detail is hidden.** Raw server text is sanitised: stack frames,
 *   file paths, HTML, and secret-looking tokens are stripped, and the result is
 *   length-capped. Unknown errors always degrade to the same generic message.
 */

import { ScholarshipApiError } from '../services/scholarship-api';

export type ScholarshipErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CROSS_TENANT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE'
  | 'DEADLINE_PASSED'
  | 'FUNDING_SHORTFALL'
  | 'IDEMPOTENCY_REPLAY'
  | 'CONCURRENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK'
  | 'UNKNOWN';

export type ScholarshipFieldError = {
  field: string;
  /** Backend code when present, else the normalised code. */
  code: string;
  /** Safe, display-only message. */
  message: string;
};

export type NormalizedScholarshipError = {
  code: ScholarshipErrorCode;
  /** Safe, display-only message. Never the raw server string. */
  message: string;
  fieldErrors: ScholarshipFieldError[];
  /** Echoed for support; never generated client-side. */
  requestId?: string;
  /** `true` when retrying the same request is meaningful. */
  retryable: boolean;
  httpStatus?: number;
};

/** Loose shape of the JSON body a scholarship endpoint may return on failure. */
export type BackendErrorBody = {
  code?: string;
  message?: string;
  requestId?: string;
  /** Either `errors` or `fieldErrors` is accepted. */
  errors?: Array<{ field?: string; code?: string; message?: string }>;
  fieldErrors?: Array<{ field?: string; code?: string; message?: string }>;
};

/** Safe, user-facing copy for every canonical code. */
const SAFE_MESSAGES: Record<ScholarshipErrorCode, string> = {
  VALIDATION_FAILED: 'Some details need fixing before this can be saved.',
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  CROSS_TENANT: 'This record belongs to a different organization.',
  NOT_FOUND: 'We could not find that record. It may have been removed.',
  CONFLICT: 'This record changed since you opened it. Reload and try again.',
  DUPLICATE: 'An application already exists for this round.',
  DEADLINE_PASSED: 'The deadline for this round has passed.',
  FUNDING_SHORTFALL: 'The funding pool is too small for this amount.',
  IDEMPOTENCY_REPLAY: 'This request was already submitted. Showing the existing record.',
  CONCURRENCY_CONFLICT: 'Someone else edited this at the same time. Reload and retry.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  SERVER_ERROR: 'Something went wrong on our side. Try again shortly.',
  NETWORK: 'We could not reach the server. Check your connection and try again.',
  UNKNOWN: 'Something went wrong. Try again, and contact support if it persists.',
};

/** Backend code → canonical code. Codes are matched case-insensitively. */
const CODE_MAP: Record<string, ScholarshipErrorCode> = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_ERROR: 'VALIDATION_FAILED',
  INVALID_INPUT: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NO_PERMISSION: 'FORBIDDEN',
  ACCESS_DENIED: 'FORBIDDEN',
  CROSS_TENANT: 'CROSS_TENANT',
  CROSS_TENANT_DENIED: 'CROSS_TENANT',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VERSION_CONFLICT: 'CONCURRENCY_CONFLICT',
  STALE_VERSION: 'CONCURRENCY_CONFLICT',
  DUPLICATE: 'DUPLICATE',
  DUPLICATE_APPLICATION: 'DUPLICATE',
  DEADLINE_PASSED: 'DEADLINE_PASSED',
  ROUND_CLOSED: 'DEADLINE_PASSED',
  FUNDING_SHORTFALL: 'FUNDING_SHORTFALL',
  INSUFFICIENT_FUNDS: 'FUNDING_SHORTFALL',
  IDEMPOTENCY_REPLAY: 'IDEMPOTENCY_REPLAY',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_REPLAY',
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'RATE_LIMITED',
  INTERNAL_ERROR: 'SERVER_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
};

const RETRYABLE: readonly ScholarshipErrorCode[] = [
  'NETWORK',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'CONCURRENCY_CONFLICT',
];

/** Maps an HTTP status to a canonical code when no backend code is supplied. */
function codeFromStatus(status: number): ScholarshipErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_FAILED';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

export function scholarshipErrorCodeFrom(backendCode?: string): ScholarshipErrorCode | undefined {
  if (!backendCode) return undefined;
  return CODE_MAP[backendCode.trim().toUpperCase()];
}

const HTML_TAG = /<[^>]*>/g;
const STACK_FRAME = /\s+at\s+[^\n]+/g;
const WINDOWS_PATH = /[A-Za-z]:\\[^\s"']+/g;
const UNIX_PATH = /(?:^|\s)\/[\w./-]{3,}/g;
const SECRET_LIKE = /\b(?:bearer|token|secret|api[_-]?key|password)\b\s*[:=]?\s*\S*/gi;

/**
 * Strips anything that must not reach a user: HTML, stack frames, filesystem
 * paths, and secret-looking tokens. Returns `undefined` when nothing safe is
 * left, so callers fall back to the canonical message.
 */
export function sanitizeServerDetail(raw?: string): string | undefined {
  if (!raw) return undefined;
  let text = raw
    .replace(HTML_TAG, ' ')
    .replace(STACK_FRAME, ' ')
    .replace(WINDOWS_PATH, ' ')
    .replace(UNIX_PATH, ' ')
    .replace(SECRET_LIKE, ' [redacted] ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  if (text.length > 200) text = `${text.slice(0, 197)}...`;
  return text;
}

function readBody(error: unknown): BackendErrorBody | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  // `ApiError` from src/types/api.ts: { message, statusCode, error }
  const maybeApiError = error as { message?: unknown; requestId?: unknown };
  const rawMessage = typeof maybeApiError.message === 'string' ? maybeApiError.message : undefined;
  const requestId = typeof maybeApiError.requestId === 'string' ? maybeApiError.requestId : undefined;

  const direct = error as BackendErrorBody;
  if (direct.errors || direct.fieldErrors || direct.code) {
    return { ...direct, requestId: direct.requestId ?? requestId };
  }

  // The API client throws the raw response text; try to parse it as JSON.
  if (rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage) as BackendErrorBody;
      if (parsed && typeof parsed === 'object') {
        return { ...parsed, requestId: parsed.requestId ?? requestId };
      }
    } catch {
      // not JSON — fall through, the raw text is handled by the caller
    }
  }

  return requestId ? { requestId } : undefined;
}

function readStatus(error: unknown): number | undefined {
  if (error instanceof ScholarshipApiError) return error.status;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { status?: unknown; statusCode?: unknown };
    if (typeof candidate.status === 'number') return candidate.status;
    if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  }
  return undefined;
}

function normaliseFieldErrors(
  body: BackendErrorBody | undefined,
  fallback: ScholarshipErrorCode,
): ScholarshipFieldError[] {
  const raw = body?.fieldErrors ?? body?.errors ?? [];
  return raw
    .filter((entry) => entry && typeof entry.field === 'string' && entry.field.trim() !== '')
    .map((entry) => {
      const code = entry.code ? entry.code : fallback;
      const safe = sanitizeServerDetail(entry.message);
      return {
        field: entry.field as string,
        code,
        message: safe ?? SAFE_MESSAGES[scholarshipErrorCodeFrom(entry.code) ?? fallback],
      };
    });
}

/** True for a network failure (fetch rejects) rather than an HTTP response. */
function isNetworkError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (name === 'TypeError') return true;
    if (name === 'AbortError') return true;
  }
  return false;
}

/**
 * The one adapter every scholarship surface uses. Pure and total: it accepts
 * anything and always returns a usable, safe error.
 */
export function normalizeScholarshipError(error: unknown): NormalizedScholarshipError {
  const status = readStatus(error);
  const body = readBody(error);

  const backendCode = body?.code;
  const mapped = scholarshipErrorCodeFrom(backendCode);
  const network = status === undefined && isNetworkError(error);

  let code: ScholarshipErrorCode;
  if (mapped) {
    code = mapped;
  } else if (network) {
    code = 'NETWORK';
  } else if (status !== undefined) {
    code = codeFromStatus(status);
  } else {
    code = 'UNKNOWN';
  }

  // CROSS_TENANT can be reported as a 403 whose specific code says more.
  const fieldErrors = normaliseFieldErrors(body, code);
  const requestId = body?.requestId;

  return {
    code,
    message: SAFE_MESSAGES[code],
    fieldErrors,
    ...(requestId ? { requestId } : {}),
    retryable: RETRYABLE.includes(code),
    ...(status !== undefined ? { httpStatus: status } : {}),
  };
}

/** Convenience map for form libraries: `{ fieldName: message }`. */
export function scholarshipFieldErrorMap(
  error: NormalizedScholarshipError,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const fieldError of error.fieldErrors) {
    if (!map[fieldError.field]) map[fieldError.field] = fieldError.message;
  }
  return map;
}

/** The support line rendered alongside an error. */
export function scholarshipErrorSupportLine(error: NormalizedScholarshipError): string {
  return error.requestId
    ? `Reference ${error.requestId} for support.`
    : 'No reference was returned; note the time of the error for support.';
}
