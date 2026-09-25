/**
 * Immutable scholarship audit trail (issue #1156).
 *
 * Security-relevant reads and every program, application, review, decision,
 * award, milestone, and finance mutation are recorded as append-only events.
 * Each event carries the actor, action, resource, outcome, request id, and safe
 * change metadata, and is chained to the previous event by hash so a record
 * cannot be edited or removed without breaking the chain. The product API
 * exposes the trail read-only.
 */

import { apiClient } from '@/src/lib/api-client';

export type ScholarshipAuditAction =
  | 'program.read'
  | 'program.published'
  | 'application.read'
  | 'application.submitted'
  | 'review.submitted'
  | 'decision.recorded'
  | 'award.accepted'
  | 'milestone.verified'
  | 'payment.finalized'
  | 'refund.issued';

export type ScholarshipAuditOutcome = 'success' | 'denied' | 'failure';

/** Reads that must be recorded because they touch sensitive applicant data. */
export const SECURITY_RELEVANT_READS: ScholarshipAuditAction[] = ['program.read', 'application.read'];

/** The product API is append-only; events can never be updated or deleted. */
export const AUDIT_TRAIL_READ_ONLY = true;

export type ScholarshipAuditChangeMetadata = {
  changedFields: string[];
  /** Human-readable, already redacted summary — never raw PII. */
  summary: string;
};

export type ScholarshipAuditEvent = {
  id: string;
  sequence: number;
  actor: string;
  action: ScholarshipAuditAction;
  resource: string;
  resourceId: string;
  outcome: ScholarshipAuditOutcome;
  requestId: string;
  occurredAt: string;
  changeMetadata: ScholarshipAuditChangeMetadata;
  previousHash: string;
  hash: string;
};

export type ScholarshipAuditEventInput = Omit<
  ScholarshipAuditEvent,
  'id' | 'sequence' | 'previousHash' | 'hash'
>;

export const GENESIS_HASH = 'genesis';

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic fingerprint used for audit hashes and export integrity. */
export function auditFingerprint(input: string): string {
  return fnv1aHex(input);
}

export function stableAuditHash(event: Omit<ScholarshipAuditEvent, 'hash'>): string {
  return auditFingerprint(JSON.stringify(event));
}

export function appendAuditEvent(
  previous: ScholarshipAuditEvent | undefined,
  input: ScholarshipAuditEventInput
): ScholarshipAuditEvent {
  const sequence = (previous?.sequence ?? 0) + 1;
  const withoutHash: Omit<ScholarshipAuditEvent, 'hash'> = {
    id: `audit-${sequence}`,
    sequence,
    actor: input.actor,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    outcome: input.outcome,
    requestId: input.requestId,
    occurredAt: input.occurredAt,
    changeMetadata: input.changeMetadata,
    previousHash: previous?.hash ?? GENESIS_HASH,
  };

  return { ...withoutHash, hash: stableAuditHash(withoutHash) };
}

export type AuditChainVerification = { valid: boolean; brokenAt?: string };

export function verifyAuditChain(events: ScholarshipAuditEvent[]): AuditChainVerification {
  let previousHash = GENESIS_HASH;

  for (const event of events) {
    const { hash, ...withoutHash } = event;
    if (event.previousHash !== previousHash) {
      return { valid: false, brokenAt: event.id };
    }
    if (hash !== stableAuditHash(withoutHash)) {
      return { valid: false, brokenAt: event.id };
    }
    previousHash = hash;
  }

  return { valid: true };
}

export const scholarshipAuditService = {
  list: (params: { resource?: string; resourceId?: string } = {}): Promise<ScholarshipAuditEvent[]> => {
    const query = new URLSearchParams();
    if (params.resource) query.set('resource', params.resource);
    if (params.resourceId) query.set('resourceId', params.resourceId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<ScholarshipAuditEvent[]>(`/scholarships/audit-events${suffix}`);
  },

  record: (input: ScholarshipAuditEventInput): Promise<ScholarshipAuditEvent> =>
    apiClient.post<ScholarshipAuditEvent>('/scholarships/audit-events', input),
};
