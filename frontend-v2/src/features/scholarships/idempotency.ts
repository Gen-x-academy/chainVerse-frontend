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
  | 'notification.send';

/** How long a key is remembered before it can be reused. */
export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

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

/** Same payload in a different key order produces the same fingerprint. */
export function fingerprintRequest(payload: unknown): string {
  return stableStringify(payload);
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
