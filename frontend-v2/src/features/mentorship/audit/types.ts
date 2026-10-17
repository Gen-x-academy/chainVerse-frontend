/**
 * Mentorship audit log (issue #1358).
 *
 * Security-relevant reads and writes are recorded with actor, tenant, target,
 * action, outcome, correlation ID, and time using tamper-evident retention.
 * Sensitive payloads are excluded; ordinary users cannot alter entries.
 */

export type MentorshipAuditAction =
  | 'mentor-profile.read'
  | 'mentor-profile.update'
  | 'mentee-profile.read'
  | 'program.read'
  | 'program.update'
  | 'program.publish'
  | 'session.read'
  | 'session.update'
  | 'verification.read'
  | 'verification.approve'
  | 'payment.read'
  | 'payment.update'
  | 'configuration.read'
  | 'configuration.update'
  | 'audit-event.read'
  | 'audit-event.export';

export type MentorshipAuditOutcome = 'success' | 'denied' | 'failure';

export type MentorshipAuditEvent = {
  id: string;
  sequence: number;
  actor: string;
  tenantId: string;
  target: string;
  action: MentorshipAuditAction;
  outcome: MentorshipAuditOutcome;
  correlationId: string;
  occurredAt: string;
  /** Backend-assigned integrity hash for tamper-evident retention. */
  integrityHash: string;
  /** Hash of the previous event in the chain. */
  previousHash: string;
  /** Redacted metadata; never contains sensitive payloads. */
  metadata?: Record<string, unknown>;
};

export type MentorshipAuditEventInput = Omit<
  MentorshipAuditEvent,
  'id' | 'sequence' | 'integrityHash' | 'previousHash'
>;

export const MENTORSHIP_AUDIT_SECURITY_RELEVANT_READS: MentorshipAuditAction[] = [
  'mentor-profile.read',
  'mentee-profile.read',
  'payment.read',
  'audit-event.read',
];

export const MENTORSHIP_AUDIT_READ_ONLY = true;

export function verifyMentorshipAuditChain(
  events: MentorshipAuditEvent[]
): { valid: true } | { valid: false; brokenAt?: string } {
  if (events.length === 0) return { valid: true };
  let previousHash = events[0].previousHash;
  for (const event of events) {
    if (event.previousHash !== previousHash) {
      return { valid: false, brokenAt: event.id };
    }
    previousHash = event.integrityHash;
  }
  return { valid: true };
}
