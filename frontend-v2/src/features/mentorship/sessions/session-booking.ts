/** MENTOR-056: book a mentorship session from an active agreement. */

import {
  HOUR_MS,
  MINUTES,
  SESSION_MODES,
  buildEventId,
  canScheduleForAgreement,
  createSessionLedger,
  formatLocalAndUtc,
  hasSessionConflict,
  isSafePlainText,
  isValidTimeZone,
  schedulingError,
  stableHash,
  toUtcIso,
  type LocalAndUtcTime,
  type MentorshipSession,
  type SchedulingActor,
  type SchedulingAgreement,
  type SchedulingError,
  type SchedulingEvent,
  type SchedulingIssue,
  type SessionLedger,
  type SessionMode,
} from './session-core';

export interface BookingPolicy {
  /** Minimum notice, in minutes, between now and the session start. */
  leadTimeMinutes: number;
  /** Durations the program allows, in minutes. */
  allowedDurationsMinutes: readonly number[];
  /** Quiet time kept free before and after a session for either participant. */
  bufferMinutes: number;
}

export interface BookSessionInput {
  actor: SchedulingActor;
  agreement: SchedulingAgreement;
  participants: { mentorId: string; menteeId: string };
  startsAt: string;
  durationMinutes: number;
  mode: SessionMode;
  /** Opaque reference to a location record. Required for in-person and hybrid. */
  locationRef?: string;
  agenda?: string;
  /** One key per user intent; a retry of the same intent reuses it. */
  idempotencyKey: string;
  /** The booker's time zone, used only to render the confirmation. */
  timeZone: string;
  policy: BookingPolicy;
}

export type BookSessionResult =
  | {
      ok: true;
      ledger: SessionLedger;
      session: MentorshipSession;
      /** Present exactly once per booking; absent on an idempotent replay. */
      event?: SchedulingEvent;
      replayed: boolean;
    }
  | { ok: false; error: SchedulingError };

export const AGENDA_MAX_LENGTH = 2000;
export const LOCATION_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  leadTimeMinutes: 120,
  allowedDurationsMinutes: [30, 45, 60, 90],
  bufferMinutes: 0,
};

/** The values that define a booking's identity; time zone is display-only. */
function fingerprintOf(input: BookSessionInput, startsAt: string): string {
  return JSON.stringify([
    input.agreement.agreementId,
    startsAt,
    input.durationMinutes,
    input.mode,
    input.locationRef ?? '',
    input.agenda ?? '',
  ]);
}

export function validateBooking(
  input: BookSessionInput,
): { issues: SchedulingIssue[]; startsAt: string | null } {
  const issues: SchedulingIssue[] = [];
  const { agreement, participants, policy } = input;

  if (participants.mentorId !== agreement.mentorId || participants.menteeId !== agreement.menteeId) {
    issues.push({
      field: 'participants',
      message: 'Participants must be the mentor and mentee named in the agreement.',
    });
  }

  const startsAt = toUtcIso(input.startsAt);
  if (!startsAt) {
    issues.push({ field: 'startsAt', message: 'Choose a valid start time.' });
  }

  if (!Number.isInteger(input.durationMinutes) || !policy.allowedDurationsMinutes.includes(input.durationMinutes)) {
    issues.push({
      field: 'durationMinutes',
      message: `Duration must be one of ${policy.allowedDurationsMinutes.join(', ')} minutes.`,
    });
  }

  if (!SESSION_MODES.includes(input.mode)) {
    issues.push({ field: 'mode', message: 'Choose virtual, in person or hybrid.' });
  } else if (input.mode !== 'virtual' && !input.locationRef) {
    issues.push({ field: 'locationRef', message: 'In-person and hybrid sessions need a location.' });
  }

  if (input.locationRef !== undefined && !LOCATION_REF_PATTERN.test(input.locationRef)) {
    issues.push({ field: 'locationRef', message: 'The location reference is not valid.' });
  }

  if (input.agenda !== undefined) {
    if (input.agenda.length > AGENDA_MAX_LENGTH) {
      issues.push({ field: 'agenda', message: `Agenda must be ${AGENDA_MAX_LENGTH} characters or fewer.` });
    } else if (!isSafePlainText(input.agenda)) {
      issues.push({ field: 'agenda', message: 'Agenda must be plain text without markup.' });
    }
  }

  if (!Number.isInteger(policy.bufferMinutes) || policy.bufferMinutes < 0) {
    issues.push({ field: 'policy', message: 'The buffer policy is invalid.' });
  }

  return { issues, startsAt };
}

/**
 * Books a session against a ledger.
 *
 * Order matters and is the contract the API must mirror:
 *   1. authorisation (deny by default, nothing else is revealed on failure)
 *   2. agreement must be active
 *   3. idempotency: a repeat of the same intent returns the original result
 *      and mints no new event; the same key with other details is rejected
 *   4. field validation
 *   5. lead time
 *   6. conflict check, which is the only guard against double booking
 *
 * The ledger is the serialisation point. Two requests for the same slot are
 * applied one after the other; the second sees the first and is refused.
 */
export function bookSession(
  ledger: SessionLedger,
  input: BookSessionInput,
  now: Date = new Date(),
): BookSessionResult {
  const { actor, agreement, policy } = input;

  if (!canScheduleForAgreement(actor, agreement)) {
    return { ok: false, error: schedulingError('NOT_AUTHORIZED') };
  }
  if (agreement.status !== 'active') {
    return { ok: false, error: schedulingError('AGREEMENT_NOT_ACTIVE') };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey ?? '')) {
    return { ok: false, error: schedulingError('IDEMPOTENCY_KEY_INVALID') };
  }
  if (!isValidTimeZone(input.timeZone)) {
    return { ok: false, error: schedulingError('INVALID_TIME_ZONE') };
  }

  const { issues, startsAt } = validateBooking(input);
  const scopedKey = `${actor.userId}|${agreement.agreementId}|${input.idempotencyKey}`;
  const prior = ledger.idempotency[scopedKey];

  if (prior) {
    const replayFingerprint = startsAt ? fingerprintOf(input, startsAt) : null;
    if (replayFingerprint !== prior.fingerprint) {
      return { ok: false, error: schedulingError('IDEMPOTENCY_KEY_REUSED') };
    }
    const existing = ledger.sessions.find((session) => session.sessionId === prior.sessionId);
    if (existing) return { ok: true, ledger, session: existing, replayed: true };
  }

  if (issues.length > 0 || !startsAt) {
    return { ok: false, error: schedulingError('INVALID_SESSION', issues) };
  }

  const startMs = Date.parse(startsAt);
  if (startMs - now.getTime() < policy.leadTimeMinutes * MINUTES) {
    return {
      ok: false,
      error: schedulingError('LEAD_TIME_VIOLATION', [
        {
          field: 'startsAt',
          message: `Sessions need at least ${leadTimeHours(policy)} hours of notice.`,
        },
      ]),
    };
  }

  const endMs = startMs + input.durationMinutes * MINUTES;
  if (
    hasSessionConflict(
      ledger.sessions,
      { mentorId: agreement.mentorId, menteeId: agreement.menteeId },
      { startMs, endMs },
      policy.bufferMinutes,
    )
  ) {
    return { ok: false, error: schedulingError('SLOT_CONFLICT') };
  }

  const endsAt = new Date(endMs).toISOString();
  const sessionId = `ses-${stableHash(scopedKey)}`;
  const session: MentorshipSession = {
    sessionId,
    agreementId: agreement.agreementId,
    engagementId: agreement.engagementId,
    tenantId: agreement.tenantId,
    mentorId: agreement.mentorId,
    menteeId: agreement.menteeId,
    startsAt,
    endsAt,
    durationMinutes: input.durationMinutes,
    mode: input.mode,
    status: 'booked',
    originalStartsAt: startsAt,
    timeChanges: [],
    revision: 1,
    bookedAt: now.toISOString(),
    bookedBy: actor.userId,
    ...(input.locationRef ? { locationRef: input.locationRef } : {}),
    ...(input.agenda ? { agenda: input.agenda } : {}),
  };

  const event: SchedulingEvent = {
    eventId: buildEventId('mentorship.session.booked', sessionId, session.revision),
    type: 'mentorship.session.booked',
    sessionId,
    agreementId: session.agreementId,
    engagementId: session.engagementId,
    tenantId: session.tenantId,
    revision: session.revision,
    occurredAt: now.toISOString(),
    actorId: actor.userId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  };

  const next = createSessionLedger({
    sessions: [...ledger.sessions, session],
    proposals: ledger.proposals,
    idempotency: {
      ...ledger.idempotency,
      [scopedKey]: { fingerprint: fingerprintOf(input, startsAt), sessionId },
    },
    events: [...ledger.events, event],
  });

  return { ok: true, ledger: next, session, event, replayed: false };
}

export interface BookingConfirmation {
  sessionId: string;
  mode: SessionMode;
  durationMinutes: number;
  time: LocalAndUtcTime;
  /** True when this response replayed an earlier identical booking. */
  replayed: boolean;
}

/** Builds the confirmation shown after booking: local time plus UTC. */
export function buildBookingConfirmation(
  session: Pick<MentorshipSession, 'sessionId' | 'startsAt' | 'endsAt' | 'mode' | 'durationMinutes'>,
  timeZone: string,
  replayed = false,
): BookingConfirmation {
  return {
    sessionId: session.sessionId,
    mode: session.mode,
    durationMinutes: session.durationMinutes,
    time: formatLocalAndUtc(session.startsAt, session.endsAt, timeZone),
    replayed,
  };
}

/** Lead time shown to users, in whole hours rounded up. */
export function leadTimeHours(policy: Pick<BookingPolicy, 'leadTimeMinutes'>): number {
  return Math.ceil((policy.leadTimeMinutes * MINUTES) / HOUR_MS);
}
