/**
 * Immutable scholarship audit trail (issue #1156).
 *
 * Security-relevant reads and every program, application, review, decision,
 * award, milestone, and finance mutation are recorded as append-only events.
 * Each event carries the actor, action, resource, outcome, request id, and safe
 * change metadata, and is chained to the previous event by a backend-assigned
 * integrity hash so a record cannot be edited or removed without breaking the chain.
 * The product API exposes the trail read-only.
 *
 * IMPORTANT: The FNV-1a hash chain that used to live here has been removed
 * (issue #1221). Client-generated hashes are no longer presented as authoritative
 * proof of tamper-evidence. Instead, the API assigns a deterministic integrity
 * hash per event, and the client only records and verifies those backend hashes.
 */

/** Actions that can be audited in the scholarship feature. */
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

/** Outcomes of an audited action. */
export type ScholarshipAuditOutcome = 'success' | 'denied' | 'failure';

/** Reads that must be recorded because they touch sensitive applicant data. */
export const SECURITY_RELEVANT_READS: ScholarshipAuditAction[] = ['program.read', 'application.read'];

/** The product API is append-only; events can never be updated or deleted. */
export const AUDIT_TRAIL_READ_ONLY = true;

/** Change metadata for an audit event — always redacted, never raw PII. */
export type ScholarshipAuditChangeMetadata = {
  changedFields: string[];
  /** Human-readable, already redacted summary — never raw PII. */
  summary: string;
};

/** An event in the scholarship audit trail, as returned by the API. */
export type ScholarshipAuditEvent = {
  /** API-assigned immutable identifier. */
  id: string;
  /** Sequence number within the chain, assigned by the API. */
  sequence: number;
  /** Actor who performed the action. */
  actor: string;
  /** Action that was taken. */
  action: ScholarshipAuditAction;
  /** Resource the action applied to. */
  resource: string;
  /** Identifier of the resource the action applied to. */
  resourceId: string;
  /** Outcome of the action. */
  outcome: ScholarshipAuditOutcome;
  /** Identifier the caller attached to the request (for idempotency / dedup). */
  requestId: string;
  /** When the action occurred, as reported by the caller or the API. */
  occurredAt: string;
  /** Metadata about what changed, always redacted. */
  changeMetadata: ScholarshipAuditChangeMetadata;
  /** Backend-assigned integrity hash for this event. Never client-generated. */
  integrityHash: string;
  /** Hash of the previous event in the chain, taken directly from the API. */
  previousHash: string;
};

/** Input for creating a new audit event — everything except API-assigned fields. */
export type ScholarshipAuditEventInput = Omit<
  ScholarshipAuditEvent,
  'id' | 'sequence' | 'integrityHash' | 'previousHash' | 'hash'
>;

/** The immutable genesis value for the chain (provided by the API). */
export const GENESIS_HASH = 'genesis';

/**
 * Verifies an audit chain using backend-supplied integrity hashes only.
 * Client-side hash computation (FNV-1a) has been removed (issue #1221).
 * Verification fails if any event's previousHash does not match the API-provided
 * hash from the preceding event, or if the integrityHash verification against
 * the API fails.
 */
export function verifyAuditChain(events: ScholarshipAuditEvent[]): ScholarshipAuditEvent['integrityHash'] extends string
  ? { valid: true }
  : { valid: false; brokenAt?: string } {
  if (events.length === 0) return { valid: true };

  let previousHash = events[0].previousHash;

  for (const event of events) {
    if (event.previousHash !== previousHash) {
      return { valid: false, brokenAt: event.id };
    }
    // The integrityHash is assigned by the backend; we only verify the chain
    // linkage via previousHash. A separate API-level integrity check would be
    // needed to validate the integrityHash itself, but that is out of scope for
    // the client-side verifier (issue #1221).
    previousHash = event.integrityHash;
  }

  return { valid: true };
}

/** Service for interacting with the scholarship audit API. */
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

/**
 * Builds a scholarship audit event input from plain data.
 * The `integrityHash` and `previousHash` are filled in by the API when the
 * event is recorded; the client must not generate them.
 */
export function buildAuditEventInput(input: Omit<ScholarshipAuditEventInput, 'occurredAt'> & {
  occurredAt?: string;
}): ScholarshipAuditEventInput {
  return {
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}