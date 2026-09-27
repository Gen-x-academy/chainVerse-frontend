/**
 * Idempotent scholarship mutations (issue #1151).
 *
 * Submissions, decisions, acceptance, milestones, payouts, refunds, and
 * notifications must be safe to retry. An idempotency key binds the actor and
 * the operation (so one actor can never replay another actor's request), is
 * stored with a fingerprint of the request payload, and has a bounded
 * retention window. Concurrent retries of the same request return the first
 * outcome; the same key with a different payload is refused as a conflict.
 */

import { apiClient } from '@/src/lib/api-client';

export type ScholarshipOperation =
  | 'application.submit'
  | 'decision.record'
  | 'award.accept'
  | 'milestone.submit'
  | 'payout.execute'
  | 'refund.issue'
  | 'withdrawal.request'
  | 'notification.send';

/** How long a key is remembered before it can be reused. */
export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Cryptographically strong client nonces (#1213).
 *
 * `Math.random()` is not acceptable here: a nonce that an attacker can predict
 * lets them pre-claim another actor's key. `crypto.randomUUID` is used where
 * available, `crypto.getRandomValues` is the fallback, and if neither exists
 * this throws rather than silently degrading to a predictable value.
 */
export function generateClientNonce(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  // Read through a widened type: older DOM lib versions do not declare
  // `randomUUID`, and the feature test should not depend on the lib version.
  const randomUUID = (cryptoRef as { randomUUID?: () => string } | undefined)?.randomUUID;
  if (typeof randomUUID === 'function' && cryptoRef) {
    return randomUUID.call(cryptoRef);
  }

  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    // Mask to 122 bits so the value is a valid RFC 4122 variant-4 UUID.
    cryptoRef.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error(
    'A secure random source is required to generate an idempotency key. crypto.randomUUID and crypto.getRandomValues are both unavailable.'
  );
}

/**
 * Whether a client nonce may be carried across attempts (#1213).
 *
 * A retry of the *same* user action must reuse its key, otherwise a double
 * click or a reload turns one intent into two mutations. A nonce is only
 * discarded once the attempt reached a terminal outcome, at which point the
 * next user action needs a fresh one.
 */
export type NonceReuse = 'reuse-on-retry' | 'single-use';

/**
 * Per-operation nonce rules. Read-only and money-moving operations are safe to
 * retry with the same key; operations whose payload changes between attempts
 * (a new decision, a new withdrawal request) must not reuse one.
 */
export const NONCE_REUSE: Record<ScholarshipOperation, NonceReuse> = {
  'application.submit': 'single-use',
  'decision.record': 'single-use',
  'award.accept': 'single-use',
  'milestone.submit': 'single-use',
  'payout.execute': 'reuse-on-retry',
  'refund.issue': 'reuse-on-retry',
  'withdrawal.request': 'single-use',
  'notification.send': 'reuse-on-retry',
};

/**
 * True when the failure was in transport rather than in the request itself, so
 * the same key should be retried.
 */
export function isRetryableTransportError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /network|timeout|timed out|ECONNRESET|ECONNABORTED|fetch failed|status 5\d\d/i.test(
    message
  );
}

/**
 * Decide whether the next attempt should reuse the current nonce.
 *
 * `terminal` is true once the mutation produced a final outcome — success,
 * rejection, or a conflict that the caller resolved by changing the request.
 */
export function shouldReuseNonce(
  operation: ScholarshipOperation,
  err: unknown,
  terminal: boolean
): boolean {
  if (NONCE_REUSE[operation] === 'single-use') return false;
  if (terminal) return false;
  return isRetryableTransportError(err);
}

export type IdempotencyKeyInput = {
  actorId: string;
  operation: ScholarshipOperation;
  resourceId: string;
  /** Random value generated once by the client for a single user action. */
  clientNonce: string;
};

export function buildIdempotencyKey(input: IdempotencyKeyInput): string {
  return `${input.operation}:${input.actorId}:${input.resourceId}:${input.clientNonce}`;
}

/**
 * Build a key, generating a strong nonce when the caller has not supplied one.
 *
 * The nonce is namespaced by operation, so the same underlying random value
 * can never collide across two different operations.
 */
export function createIdempotentKey(
  input: Omit<IdempotencyKeyInput, 'clientNonce'> & { clientNonce?: string }
): { key: string; clientNonce: string } {
  const clientNonce = input.clientNonce ?? generateClientNonce();
  return {
    clientNonce,
    key: buildIdempotencyKey({ ...input, clientNonce }),
  };
}

/**
 * Payload keys whose values must never reach a fingerprint, an idempotency
 * record, or any client-side log (#1216).
 *
 * Withdrawal reasons in particular are sensitive free text, and a fingerprint is
 * persisted server-side for the full retention window.
 */
const SENSITIVE_FINGERPRINT_KEYS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'reason',
  'reasondetail',
  'reason_detail',
  'note',
  'notes',
  'ssn',
  'dob',
  'dateofbirth',
];

function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase();
  return SENSITIVE_FINGERPRINT_KEYS.some((candidate) => normalised.includes(candidate));
}

function redactForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForFingerprint);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redactForFingerprint(entry);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

/**
 * Same payload in a different key order produces the same fingerprint.
 *
 * Sensitive values are replaced before fingerprinting, so a withdrawal reason
 * or any other secret is not persisted in an idempotency record for the full
 * retention window (#1216). The trade-off is deliberate: two requests that
 * differ only in a redacted field share a fingerprint, which is safe because
 * those fields are not part of what the key is protecting.
 */
export function fingerprintRequest(payload: unknown): string {
  return stableStringify(redactForFingerprint(payload));
}

export type IdempotencyRecord = {
  key: string;
  actorId: string;
  operation: ScholarshipOperation;
  requestFingerprint: string;
  /** Serialized identifier of the outcome produced by the first attempt. */
  outcome: string;
  createdAt: string;
  expiresAt: string;
};

export type IdempotencyRequest = {
  key: string;
  actorId: string;
  operation: ScholarshipOperation;
  requestFingerprint: string;
};

export type IdempotencyDecision =
  | { action: 'proceed' }
  | { action: 'replay'; outcome: string }
  | { action: 'conflict'; reason: 'KEY_BOUND_TO_OTHER_REQUEST' | 'PAYLOAD_MISMATCH' };

export function isRecordExpired(record: IdempotencyRecord, now: Date = new Date()): boolean {
  return Date.parse(record.expiresAt) <= now.getTime();
}

export function decideIdempotentMutation(
  existing: IdempotencyRecord | undefined,
  request: IdempotencyRequest,
  now: Date = new Date()
): IdempotencyDecision {
  if (!existing || isRecordExpired(existing, now)) {
    return { action: 'proceed' };
  }

  if (existing.actorId !== request.actorId || existing.operation !== request.operation) {
    return { action: 'conflict', reason: 'KEY_BOUND_TO_OTHER_REQUEST' };
  }

  if (existing.requestFingerprint !== request.requestFingerprint) {
    return { action: 'conflict', reason: 'PAYLOAD_MISMATCH' };
  }

  return { action: 'replay', outcome: existing.outcome };
}

export function createIdempotencyRecord(
  request: IdempotencyRequest,
  outcome: string,
  now: Date = new Date()
): IdempotencyRecord {
  return {
    key: request.key,
    actorId: request.actorId,
    operation: request.operation,
    requestFingerprint: request.requestFingerprint,
    outcome,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS).toISOString(),
  };
}

/** Bounded retention: expired keys are dropped instead of growing forever. */
export function pruneExpiredRecords(
  records: IdempotencyRecord[],
  now: Date = new Date()
): IdempotencyRecord[] {
  return records.filter((record) => !isRecordExpired(record, now));
}

export const scholarshipIdempotencyService = {
  get: (key: string): Promise<IdempotencyRecord | null> =>
    apiClient.get<IdempotencyRecord | null>(
      `/scholarships/idempotency-keys/${encodeURIComponent(key)}`
    ),

  remember: (record: IdempotencyRecord): Promise<IdempotencyRecord> =>
    apiClient.post<IdempotencyRecord>('/scholarships/idempotency-keys', record),
};

// ---------------------------------------------------------------------------
// Idempotent withdrawal commands (#1216)
// ---------------------------------------------------------------------------

/** The fields a withdrawal submission is allowed to bind an idempotency key to. */
export type WithdrawalCommandInput = {
  actorId: string;
  applicationId: string;
  reasonCategory: string;
  /** Free-text reason. Never included in the fingerprint. */
  reasonDetail?: string;
  confirmed: boolean;
};

export type WithdrawalCommand = {
  operation: 'withdrawal.request';
  key: string;
  clientNonce: string;
  requestFingerprint: string;
  request: IdempotencyRequest;
};

/**
 * Build an idempotent withdrawal submission.
 *
 * The caller passes the same `clientNonce` when retrying the same withdrawal
 * (a double click, a reload mid-flight) so the backend collapses it into one
 * record; a genuinely new withdrawal gets a fresh nonce. `reasonDetail` is
 * excluded from the fingerprint so a sensitive reason is not retained in the
 * idempotency store.
 */
export function buildWithdrawalCommand(
  input: WithdrawalCommandInput,
  clientNonce?: string
): WithdrawalCommand {
  const { key, clientNonce: nonce } = createIdempotencyKey({
    actorId: input.actorId,
    operation: 'withdrawal.request',
    resourceId: input.applicationId,
    ...(clientNonce ? { clientNonce } : {}),
  });

  return {
    operation: 'withdrawal.request',
    key,
    clientNonce: nonce,
    requestFingerprint: fingerprintRequest(input),
    request: {
      key,
      actorId: input.actorId,
      operation: 'withdrawal.request',
      requestFingerprint: fingerprintRequest(input),
    },
  };
}
