/**
 * Shared primitives for the Integrity track frontend (CAPSTONE-097/-098/-099/-102).
 *
 * Every aggregate in this track is tenant-scoped, deny-by-default, versioned
 * and idempotent. Audit events are derived from allowlisted metadata only so
 * private proposal, research, identity, safety and financial content can never
 * reach logs or audit records.
 */
/** Local typed transport; intentionally independent of the shared api-client module. */
export class IntegrityApiError extends Error {
  public readonly status: number;
  public readonly currentVersion?: string | number;

  constructor(message: string, status: number, currentVersion?: string | number) {
    super(message);
    this.status = status;
    this.currentVersion = currentVersion;
    this.name = 'IntegrityApiError';
  }
}

export class IntegrityConflictError extends IntegrityApiError {
  constructor(message: string, currentVersion?: string | number) {
    super(message, 409, currentVersion);
    this.name = 'IntegrityConflictError';
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function transport<T>(path: string, init: RequestInit = {}, requestId?: string, expectedRevision?: number): Promise<T> {
  if (!BASE_URL) throw new IntegrityApiError('The integrity API is not configured.', 503);
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(requestId ? { 'Idempotency-Key': requestId } : {}),
    ...(expectedRevision !== undefined ? { 'If-Match': String(expectedRevision) } : {}),
  };
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${BASE_URL}/integrity${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message : `Request failed (${response.status}).`;
    const version = body?.currentVersion ?? body?.version;
    if (response.status === 409 || response.status === 412) throw new IntegrityConflictError(message, version);
    throw new IntegrityApiError(message, response.status, version);
  }
  return response.json() as Promise<T>;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const INTEGRITY_ERRORS = {
  FORBIDDEN: 'INTEGRITY_FORBIDDEN',
  TENANT_MISMATCH: 'INTEGRITY_TENANT_MISMATCH',
  NOT_FOUND: 'INTEGRITY_NOT_FOUND',
  VALIDATION_FAILED: 'INTEGRITY_VALIDATION_FAILED',
  STALE_VERSION: 'INTEGRITY_STALE_VERSION',
  INVALID_TRANSITION: 'INTEGRITY_INVALID_TRANSITION',
  CONFLICT: 'INTEGRITY_CONFLICT',
  DUPLICATE_REQUEST: 'INTEGRITY_DUPLICATE_REQUEST',
  CONSENT_REQUIRED: 'INTEGRITY_CONSENT_REQUIRED',
  DEADLINE_PASSED: 'INTEGRITY_DEADLINE_PASSED',
} as const;

export type IntegrityErrorCode = (typeof INTEGRITY_ERRORS)[keyof typeof INTEGRITY_ERRORS];

export interface IntegrityActor {
  actorId: string;
  tenantId: string;
  /** Roles granted by the server for this tenant. Never inferred from the UI. */
  roles: readonly string[];
  /** Explicit capabilities granted by the server. */
  permissions: readonly string[];
}

export interface IntegrityAggregate {
  tenantId: string;
  /** Optimistic concurrency token; increases on every applied change. */
  revision: number;
}

export type IntegrityFailure = {
  ok: false;
  code: IntegrityErrorCode;
  message: string;
  /** Allowed transitions / fields, safe to render to the user. */
  details?: readonly string[];
};

export type IntegrityResult<T> = { ok: true; value: T; replayed?: boolean } | IntegrityFailure;

export const ok = <T>(value: T, replayed = false): IntegrityResult<T> => ({ ok: true, value, replayed });
export const fail = (code: IntegrityErrorCode, message: string, details?: readonly string[]): IntegrityFailure => ({
  ok: false,
  code,
  message,
  ...(details ? { details } : {}),
});

/** Deny-by-default authorization: no tenant, role or capability means no access. */
export function can(actor: IntegrityActor, capability: string): boolean {
  return Boolean(actor.tenantId && actor.actorId && actor.permissions.includes(capability));
}

export function authorize(actor: IntegrityActor, capability: string): IntegrityFailure | null {
  if (!actor.tenantId || !actor.actorId) return fail(INTEGRITY_ERRORS.FORBIDDEN, 'Sign in to continue.');
  if (!can(actor, capability)) return fail(INTEGRITY_ERRORS.FORBIDDEN, 'You do not have permission to perform this action.');
  return null;
}

export function inTenant<T extends IntegrityAggregate>(
  actor: IntegrityActor,
  aggregate: T | undefined,
): aggregate is T {
  return Boolean(aggregate && aggregate.tenantId === actor.tenantId);
}

export function tenantGuard<T extends IntegrityAggregate>(
  actor: IntegrityActor,
  aggregate: T | undefined,
): IntegrityFailure | null {
  if (!aggregate) return fail(INTEGRITY_ERRORS.NOT_FOUND, 'The record was not found.');
  if (aggregate.tenantId !== actor.tenantId) {
    return fail(INTEGRITY_ERRORS.TENANT_MISMATCH, 'The record belongs to another tenant.');
  }
  return null;
}

export function versionGuard<T extends IntegrityAggregate>(
  aggregate: T,
  expectedRevision: number,
): IntegrityFailure | null {
  if (aggregate.revision !== expectedRevision) {
    return fail(
      INTEGRITY_ERRORS.STALE_VERSION,
      `This record changed (revision ${aggregate.revision}); reload before retrying.`,
      [`currentRevision:${aggregate.revision}`],
    );
  }
  return null;
}

/** Replays the outcome of a request id so retries never duplicate side effects. */
export function replay<T>(
  ledger: Map<string, IntegrityResult<T>>,
  requestId: string,
  compute: () => IntegrityResult<T>,
): IntegrityResult<T> {
  const previous = ledger.get(requestId);
  if (previous) return previous.ok ? { ...previous, replayed: true } : previous;
  const result = compute();
  ledger.set(requestId, result);
  return result;
}

const SAFE_AUDIT_KEYS = new Set([
  'aggregateId',
  'action',
  'category',
  'status',
  'fromStatus',
  'toStatus',
  'requestId',
  'revision',
  'reasonCode',
  'thresholdVersion',
]);

/** Build an audit event from allowlisted keys; never pass request bodies here. */
export function auditEvent(
  action: string,
  actor: IntegrityActor,
  aggregateId: string,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const safe: Record<string, unknown> = {
    type: `integrity.${action}`,
    actorId: actor.actorId,
    tenantId: actor.tenantId,
    aggregateId,
    at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(metadata)) {
    if (SAFE_AUDIT_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number')) {
      safe[key] = value;
    }
  }
  return safe;
}

/** Typed transport for integrity endpoints; retries reuse the request id as key. */
export const integrityApi = {
  get: <T>(path: string) => transport<T>(path),
  mutate: <T>(path: string, requestId: string, body: unknown, expectedRevision?: number) =>
    transport<T>(path, { method: 'POST', body: JSON.stringify(body) }, requestId, expectedRevision),
  newRequestId,
};
