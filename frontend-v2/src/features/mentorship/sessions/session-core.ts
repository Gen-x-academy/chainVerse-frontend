/**
 * Shared scheduling primitives for MENTOR-056 to MENTOR-059.
 *
 * Everything here is pure and deterministic. The frontend is authoritative for
 * preconditions and presentation only: the API must re-run every check and own
 * the real transaction. These helpers define the contract it must honour.
 */

import type { AgreementStatus } from '../agreements/engagement-agreement';
import type { DeliveryMode } from '../programs/delivery-modes';
import type { MentorshipRole } from '../rbac';

/** Real-time modes only; asynchronous mentoring has no session to schedule. */
export type SessionMode = Exclude<DeliveryMode, 'async'>;

export const SESSION_MODES: readonly SessionMode[] = ['virtual', 'in_person', 'hybrid'];

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  virtual: 'Virtual',
  in_person: 'In person',
  hybrid: 'Hybrid',
};

export type SchedulingRole = 'mentor' | 'mentee' | 'coordinator' | 'administrator';

/**
 * Maps a mentorship role onto a scheduling role. Roles that have no scheduling
 * duty (guardians, finance, moderators, tutors) map to nothing, so they are
 * denied by default.
 */
export function toSchedulingRole(role: MentorshipRole | undefined): SchedulingRole | undefined {
  switch (role) {
    case 'mentor':
      return 'mentor';
    case 'student':
      return 'mentee';
    case 'organization-staff':
      return 'coordinator';
    case 'administrator':
      return 'administrator';
    default:
      return undefined;
  }
}

export interface SchedulingActor {
  userId: string;
  role: SchedulingRole;
  tenantId: string;
}

/** The slice of an engagement agreement that scheduling needs. */
export interface SchedulingAgreement {
  agreementId: string;
  engagementId: string;
  tenantId: string;
  status: AgreementStatus;
  mentorId: string;
  menteeId: string;
}

export type SessionStatus = 'booked' | 'cancelled' | 'completed';

/** One applied change of time. Together they trace every move from the original. */
export interface SessionTimeChange {
  proposalId: string;
  fromStartsAt: string;
  toStartsAt: string;
  changedAt: string;
  /** Who asked for the change. */
  requestedBy: string;
  /** Who approved it, or the coordinator who applied it directly. */
  approvedBy: string;
  /** Visible to the participants and coordinators; never sent in events. */
  reason: string;
  override: boolean;
}

export type CancellationReasonCode =
  | 'schedule_conflict'
  | 'illness'
  | 'emergency'
  | 'no_longer_needed'
  | 'technical_problem'
  | 'other'
  | 'platform_action';

export const CANCELLATION_REASON_LABELS: Record<CancellationReasonCode, string> = {
  schedule_conflict: 'Schedule conflict',
  illness: 'Illness',
  emergency: 'Emergency',
  no_longer_needed: 'No longer needed',
  technical_problem: 'Technical problem',
  other: 'Other',
  platform_action: 'Platform action',
};

/** What the cancellation cost, frozen at the moment it happened. */
export interface SessionCancellation {
  cancelledAt: string;
  cancelledBy: string;
  cancelledByRole: 'mentee' | 'mentor' | 'platform';
  reasonCode: CancellationReasonCode;
  /** Visible to participants and coordinators; never sent in events. */
  note: string;
  noticeHours: number;
  /** The policy that priced this cancellation, so it can be audited later. */
  policyId: string;
  policyVersion: number;
  appliedRefundBps: number;
  refundMinor: number;
  mentorCompensationMinor: number;
  platformFeeMinor: number;
  settlementInstructionId: string;
}

/** The single instruction sent downstream to settlement for a cancelled session. */
export interface SettlementInstruction {
  instructionId: string;
  sessionId: string;
  agreementId: string;
  tenantId: string;
  policyId: string;
  policyVersion: number;
  refundMinor: number;
  mentorCompensationMinor: number;
  platformFeeMinor: number;
  createdAt: string;
}

export interface MentorshipSession {
  sessionId: string;
  agreementId: string;
  engagementId: string;
  tenantId: string;
  mentorId: string;
  menteeId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  mode: SessionMode;
  /** Opaque reference to a location record; never a free-text address. */
  locationRef?: string;
  agenda?: string;
  status: SessionStatus;
  /** The time first booked. It is never overwritten, so it stays traceable. */
  originalStartsAt: string;
  /** Applied time changes, oldest first. */
  timeChanges: readonly SessionTimeChange[];
  /** Present once the session has been cancelled. */
  cancellation?: SessionCancellation;
  /** Increments on every change so events and approvals can be tied to a state. */
  revision: number;
  bookedAt: string;
  bookedBy: string;
}

export interface TimeInterval {
  startsAt: string;
  endsAt: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface SchedulingIssue {
  field: string;
  message: string;
}

interface ErrorDefinition {
  status: number;
  message: string;
  /** True when the same request can safely be sent again unchanged. */
  retryable: boolean;
}

/**
 * Stable, actionable errors. Codes and messages never embed personal data, so
 * they are safe to log, show and send to analytics.
 */
export const SCHEDULING_ERRORS = {
  NOT_AUTHORIZED: {
    status: 403,
    message: 'You do not have permission to schedule sessions for this agreement.',
    retryable: false,
  },
  AGREEMENT_NOT_ACTIVE: {
    status: 409,
    message: 'Sessions can only be booked while the agreement is active. Ask the other participant to accept it first.',
    retryable: false,
  },
  INVALID_SESSION: {
    status: 422,
    message: 'The session details are invalid. Fix the highlighted fields and try again.',
    retryable: false,
  },
  INVALID_TIME_ZONE: {
    status: 422,
    message: 'The time zone is not recognised. Choose a valid time zone and try again.',
    retryable: false,
  },
  LEAD_TIME_VIOLATION: {
    status: 422,
    message: 'This time is too soon to book. Choose a later slot.',
    retryable: false,
  },
  SLOT_CONFLICT: {
    status: 409,
    message: 'One of the participants already has a session at this time. Search for another slot.',
    retryable: false,
  },
  IDEMPOTENCY_KEY_INVALID: {
    status: 400,
    message: 'The request key is missing or malformed. Reload the page and try again.',
    retryable: false,
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    message: 'This request key was already used for different details. Reload the page and try again.',
    retryable: false,
  },
  SESSION_NOT_BOOKED: {
    status: 409,
    message: 'Only a booked session can be changed. Check the session status.',
    retryable: false,
  },
  RESCHEDULE_NOTICE_VIOLATION: {
    status: 422,
    message: 'It is too close to the session start to reschedule. Contact a coordinator if this is urgent.',
    retryable: false,
  },
  PAYMENT_PREVIEW_MISMATCH: {
    status: 409,
    message: 'The fee for this change has changed. Review the updated amount and confirm again.',
    retryable: false,
  },
  PROPOSAL_NOT_PENDING: {
    status: 409,
    message: 'This reschedule request has already been answered or replaced.',
    retryable: false,
  },
  PROPOSAL_STALE: {
    status: 409,
    message: 'The session changed after this request was made, so it can no longer be approved. Ask for a new time.',
    retryable: false,
  },
  PROPOSAL_EXPIRED: {
    status: 410,
    message: 'This reschedule request has expired. Ask for a new time.',
    retryable: false,
  },
  APPROVAL_NOT_ALLOWED: {
    status: 403,
    message: 'Only the other participant can answer this request. You can withdraw it instead.',
    retryable: false,
  },
  SESSION_STARTED: {
    status: 409,
    message: 'This session has already started, so it can no longer be cancelled. Report a no-show if someone did not attend.',
    retryable: false,
  },
  UNKNOWN: {
    status: 500,
    message: 'The scheduling request failed. Check your connection and try again. Retrying will not create duplicates.',
    retryable: true,
  },
} as const satisfies Record<string, ErrorDefinition>;

export type SchedulingErrorCode = keyof typeof SCHEDULING_ERRORS;

export interface SchedulingError {
  code: SchedulingErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  issues?: SchedulingIssue[];
}

export function schedulingError(
  code: SchedulingErrorCode,
  issues?: SchedulingIssue[],
): SchedulingError {
  const definition: ErrorDefinition = SCHEDULING_ERRORS[code];
  const error: SchedulingError = {
    code,
    message: definition.message,
    status: definition.status,
    retryable: definition.retryable,
  };
  if (issues && issues.length > 0) error.issues = issues;
  return error;
}

/**
 * Turns anything thrown by the API client into a stable, displayable failure.
 * The client throws a plain `Error` whose message is the response body, so a
 * JSON body carrying a known `code` is honoured and everything else falls back
 * to the generic retryable failure.
 */
export function describeSchedulingFailure(error: unknown): SchedulingError {
  const known = (code: unknown): code is SchedulingErrorCode =>
    typeof code === 'string' && Object.prototype.hasOwnProperty.call(SCHEDULING_ERRORS, code);

  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; issues?: unknown };
    if (known(candidate.code)) {
      return schedulingError(candidate.code, Array.isArray(candidate.issues) ? (candidate.issues as SchedulingIssue[]) : undefined);
    }
  }
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as { code?: unknown; issues?: unknown };
      if (known(parsed.code)) {
        return schedulingError(parsed.code, Array.isArray(parsed.issues) ? (parsed.issues as SchedulingIssue[]) : undefined);
      }
    } catch {
      // Not a JSON body; fall through to the generic failure.
    }
  }
  return schedulingError('UNKNOWN');
}

// ---------------------------------------------------------------------------
// Reschedule requests
// ---------------------------------------------------------------------------

export type RescheduleStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'withdrawn'
  | 'superseded'
  | 'expired';

export interface RescheduleProposal {
  proposalId: string;
  sessionId: string;
  agreementId: string;
  tenantId: string;
  proposedBy: string;
  /** The session revision this request was made against. */
  baseRevision: number;
  currentStartsAt: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  /** Visible to both participants and coordinators; never sent in events. */
  reason: string;
  status: RescheduleStatus;
  /** Fee the requester accepted when they saw the preview, in minor units. */
  feeMinor: number;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SchedulingEventType =
  | 'mentorship.session.booked'
  | 'mentorship.session.reschedule_proposed'
  | 'mentorship.session.rescheduled'
  | 'mentorship.session.reschedule_closed'
  | 'mentorship.session.cancelled';

/**
 * Canonical domain event. The id is derived from the type, the session and its
 * revision, so a retry can never mint a second event for the same fact and
 * consumers can dedupe on it. It carries identifiers and times only: never the
 * agenda, a location or any free text.
 */
export interface SchedulingEvent {
  eventId: string;
  type: SchedulingEventType;
  sessionId: string;
  agreementId: string;
  engagementId: string;
  tenantId: string;
  revision: number;
  occurredAt: string;
  actorId: string;
  startsAt: string;
  endsAt: string;
  /** Present on reschedule events: the time before the change. */
  previousStartsAt?: string;
  /** Present on reschedule events: the request the event belongs to. */
  proposalId?: string;
  /** Present on a closed reschedule request. */
  outcome?: 'declined' | 'withdrawn';
  /** Present on a cancellation: a category, never free text. */
  reasonCode?: CancellationReasonCode;
  cancelledByRole?: 'mentee' | 'mentor' | 'platform';
  /** Present on a cancellation: the one settlement instruction it produced. */
  settlementInstructionId?: string;
}

/** Idempotency record kept per actor and key. */
export interface IdempotencyRecord {
  fingerprint: string;
  sessionId: string;
  proposalId?: string;
}

/** The serialisation point: every mutation returns a new ledger. */
export interface SessionLedger {
  sessions: readonly MentorshipSession[];
  proposals: readonly RescheduleProposal[];
  settlements: readonly SettlementInstruction[];
  idempotency: Readonly<Record<string, IdempotencyRecord>>;
  events: readonly SchedulingEvent[];
}

export function createSessionLedger(initial: Partial<SessionLedger> = {}): SessionLedger {
  return {
    sessions: initial.sessions ?? [],
    proposals: initial.proposals ?? [],
    settlements: initial.settlements ?? [],
    idempotency: initial.idempotency ?? {},
    events: initial.events ?? [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const MINUTES = MINUTE_MS;

/** 53-bit string hash (cyrb53). Stable across runs and platforms. */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The id is fixed by the type, the session, its revision and, for request
 * events, the request itself. Two requests made against one revision therefore
 * never share an id, and a retry always reproduces the same one.
 */
export function buildEventId(
  type: SchedulingEventType,
  sessionId: string,
  revision: number,
  discriminator = '',
): string {
  return `evt-${stableHash(`${type}|${sessionId}|${revision}|${discriminator}`)}`;
}

/** A fresh request key for one user intent, for example `resch-<uuid>`. */
export function createIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Parses an instant and returns it as a canonical UTC ISO string, or null. */
export function toUtcIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

/** Half-open interval overlap: sessions that merely touch do not conflict. */
export function intervalsOverlap(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/**
 * True when a session of either participant overlaps the wanted range once the
 * buffer is applied. Half open, so back-to-back sessions only clash through the
 * buffer. Cancelled sessions never block, and a session being moved can be
 * excluded so it does not conflict with itself.
 */
export function hasSessionConflict(
  sessions: readonly MentorshipSession[],
  participants: { mentorId: string; menteeId: string },
  range: { startMs: number; endMs: number },
  bufferMinutes: number,
  excludeSessionId?: string,
): boolean {
  const bufferMs = bufferMinutes * MINUTES;
  const wanted = { startMs: range.startMs - bufferMs, endMs: range.endMs + bufferMs };
  return sessions.some((session) => {
    if (session.status !== 'booked' || session.sessionId === excludeSessionId) return false;
    const shares =
      session.mentorId === participants.mentorId ||
      session.mentorId === participants.menteeId ||
      session.menteeId === participants.mentorId ||
      session.menteeId === participants.menteeId;
    if (!shares) return false;
    return intervalsOverlap(wanted, {
      startMs: Date.parse(session.startsAt),
      endMs: Date.parse(session.endsAt),
    });
  });
}

/** Closes every other pending request on a session so it can no longer be approved. */
export function supersedePendingProposals(
  proposals: readonly RescheduleProposal[],
  sessionId: string,
  keepProposalId: string | null,
  now: Date,
): RescheduleProposal[] {
  return proposals.map((proposal) =>
    proposal.sessionId === sessionId && proposal.proposalId !== keepProposalId && proposal.status === 'pending'
      ? { ...proposal, status: 'superseded' as const, decidedAt: now.toISOString() }
      : proposal,
  );
}

const UNSAFE_TEXT = /<\s*\/?\s*[a-z!][^>]*>|javascript:/i;

/** Free text is plain text: markup and script URLs are rejected, not stripped. */
export function isSafePlainText(value: string): boolean {
  return !UNSAFE_TEXT.test(value);
}

/**
 * Deny-by-default participant check. The actor must belong to the agreement's
 * tenant and be one of its two participants or a coordinator/administrator.
 */
export function canScheduleForAgreement(
  actor: SchedulingActor,
  agreement: Pick<SchedulingAgreement, 'tenantId' | 'mentorId' | 'menteeId'>,
): boolean {
  if (actor.tenantId !== agreement.tenantId) return false;
  switch (actor.role) {
    case 'mentor':
      return actor.userId === agreement.mentorId;
    case 'mentee':
      return actor.userId === agreement.menteeId;
    case 'coordinator':
    case 'administrator':
      return true;
    default:
      return false;
  }
}

export interface LocalAndUtcTime {
  timeZone: string;
  /** The range in the viewer's time zone, with the zone abbreviation. */
  local: string;
  /** The same range in UTC. */
  utc: string;
  startsAtUtc: string;
  endsAtUtc: string;
}

/**
 * Confirmations always show the viewer's local time and the UTC time, so two
 * participants in different zones can verify they agree on the same instant.
 */
export function formatLocalAndUtc(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): LocalAndUtcTime {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const describe = (tz: string, hour12: boolean): string => {
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(start);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12,
    });
    const zoneName =
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(start)
        .find((part) => part.type === 'timeZoneName')?.value ?? tz;
    return `${date}, ${time.format(start)} to ${time.format(end)} ${zoneName}`;
  };

  return {
    timeZone: zone,
    local: describe(zone, true),
    utc: describe('UTC', false),
    startsAtUtc: start.toISOString(),
    endsAtUtc: end.toISOString(),
  };
}
