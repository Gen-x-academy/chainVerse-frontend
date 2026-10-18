/** MENTOR-057: reschedule mentorship sessions. */

import { IDEMPOTENCY_KEY_PATTERN } from './session-booking';
import {
  HOUR_MS,
  MINUTES,
  buildEventId,
  canScheduleForAgreement,
  createSessionLedger,
  hasSessionConflict,
  isSafePlainText,
  schedulingError,
  stableHash,
  toUtcIso,
  type MentorshipSession,
  type RescheduleProposal,
  type SchedulingActor,
  type SchedulingError,
  type SchedulingEvent,
  type SchedulingEventType,
  type SchedulingIssue,
  type SchedulingRole,
  type SessionLedger,
  type SessionStatus,
} from './session-core';

export interface ReschedulePolicy {
  /** Below this notice, before the current start, participants cannot reschedule. */
  minNoticeHours: number;
  /** At or above this notice a reschedule is free. */
  freeNoticeHours: number;
  /** Share of the session amount charged to a mentee for a late change, in basis points. */
  lateFeeBps: number;
  /** How long the other participant has to answer. */
  approvalTtlHours: number;
  /** The new start must be at least this far in the future. */
  leadTimeMinutes: number;
  bufferMinutes: number;
}

export const DEFAULT_RESCHEDULE_POLICY: ReschedulePolicy = {
  minNoticeHours: 12,
  freeNoticeHours: 48,
  lateFeeBps: 2500,
  approvalTtlHours: 48,
  leadTimeMinutes: 120,
  bufferMinutes: 0,
};

export const REASON_MIN_LENGTH = 5;
export const REASON_MAX_LENGTH = 500;

const BPS = 10_000;

export interface ReschedulePreview {
  noticeHours: number;
  /** True when notice is below the free window. */
  late: boolean;
  /** True when notice is below the minimum and the requester is not a coordinator. */
  blocked: boolean;
  /** Who would pay the fee. Mentors and coordinators never do. */
  payer: 'mentee' | 'none';
  feeMinor: number;
  explanation: string[];
}

export interface PreviewRescheduleInput {
  /** The session's current start. */
  currentStartsAt: string;
  amountMinor: number;
  requesterRole: SchedulingRole;
  policy: ReschedulePolicy;
  now: Date;
}

/**
 * Shows what a reschedule would cost before anyone commits to it. The same
 * function decides the fee when the request is made, so the preview and the
 * charge can never disagree.
 */
export function previewRescheduleConsequences(input: PreviewRescheduleInput): ReschedulePreview {
  const { policy, amountMinor, requesterRole } = input;
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error('Amount must be a non-negative integer in minor units');
  }
  if (!Number.isInteger(policy.lateFeeBps) || policy.lateFeeBps < 0 || policy.lateFeeBps > BPS) {
    throw new Error('Late fee must be between 0 and 10000 basis points');
  }

  const noticeHours = (Date.parse(input.currentStartsAt) - input.now.getTime()) / HOUR_MS;
  const privileged = requesterRole === 'coordinator' || requesterRole === 'administrator';
  const blocked = !privileged && noticeHours < policy.minNoticeHours;
  const late = noticeHours < policy.freeNoticeHours;
  const charged = requesterRole === 'mentee' && late && !blocked;
  const feeMinor = charged ? Math.round((amountMinor * policy.lateFeeBps) / BPS) : 0;

  const rounded = Math.round(noticeHours * 10) / 10;
  const explanation = [`${rounded} hours of notice before the current start.`];
  if (blocked) {
    explanation.push(`Changes need at least ${policy.minNoticeHours} hours of notice.`);
  } else if (!late) {
    explanation.push(`At least ${policy.freeNoticeHours} hours of notice, so there is no fee.`);
  } else if (charged) {
    explanation.push(
      `Under ${policy.freeNoticeHours} hours of notice: ${policy.lateFeeBps / 100}% of ${amountMinor} is ${feeMinor} minor units.`,
    );
  } else {
    explanation.push('Late, but this requester is not charged.');
  }

  return { noticeHours, late, blocked, payer: charged ? 'mentee' : 'none', feeMinor, explanation };
}

export interface ProposeRescheduleInput {
  actor: SchedulingActor;
  sessionId: string;
  proposedStartsAt: string;
  reason: string;
  /** The fee shown in the preview. It must still match when the request is made. */
  acknowledgedFeeMinor: number;
  /** The session price from the payment snapshot, in minor units. */
  amountMinor: number;
  idempotencyKey: string;
  policy: ReschedulePolicy;
}

export type RescheduleResult =
  | {
      ok: true;
      ledger: SessionLedger;
      proposal: RescheduleProposal;
      session: MentorshipSession;
      /** Present exactly once per new fact; absent on a replay. */
      event?: SchedulingEvent;
      replayed: boolean;
    }
  | { ok: false; error: SchedulingError };

function fail(code: Parameters<typeof schedulingError>[0], issues?: SchedulingIssue[]): { ok: false; error: SchedulingError } {
  return { ok: false, error: schedulingError(code, issues) };
}

function findSession(ledger: SessionLedger, sessionId: string): MentorshipSession | undefined {
  return ledger.sessions.find((session) => session.sessionId === sessionId);
}

function validateChange(
  session: MentorshipSession,
  proposedStartsAt: string,
  reason: string,
): { issues: SchedulingIssue[]; startsAt: string | null } {
  const issues: SchedulingIssue[] = [];
  const startsAt = toUtcIso(proposedStartsAt);
  if (!startsAt) {
    issues.push({ field: 'proposedStartsAt', message: 'Choose a valid new start time.' });
  } else if (startsAt === session.startsAt) {
    issues.push({ field: 'proposedStartsAt', message: 'Choose a different time from the current one.' });
  }
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < REASON_MIN_LENGTH) {
    issues.push({ field: 'reason', message: `Give a reason of at least ${REASON_MIN_LENGTH} characters.` });
  } else if (trimmed.length > REASON_MAX_LENGTH) {
    issues.push({ field: 'reason', message: `Keep the reason to ${REASON_MAX_LENGTH} characters or fewer.` });
  } else if (!isSafePlainText(trimmed)) {
    issues.push({ field: 'reason', message: 'The reason must be plain text without markup.' });
  }
  return { issues, startsAt };
}

function newRange(session: MentorshipSession, startsAt: string) {
  const startMs = Date.parse(startsAt);
  return { startMs, endMs: startMs + session.durationMinutes * MINUTES };
}

function closeSuperseded(proposals: readonly RescheduleProposal[], sessionId: string, keepId: string, now: Date) {
  return proposals.map((proposal) =>
    proposal.sessionId === sessionId && proposal.proposalId !== keepId && proposal.status === 'pending'
      ? { ...proposal, status: 'superseded' as const, decidedAt: now.toISOString() }
      : proposal,
  );
}

function eventFor(
  type: SchedulingEventType,
  session: MentorshipSession,
  actorId: string,
  proposalId: string,
  now: Date,
  extra: Partial<SchedulingEvent> = {},
): SchedulingEvent {
  return {
    eventId: buildEventId(type, session.sessionId, session.revision, proposalId),
    type,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    engagementId: session.engagementId,
    tenantId: session.tenantId,
    revision: session.revision,
    occurredAt: now.toISOString(),
    actorId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    proposalId,
    ...extra,
  };
}

/**
 * A participant asks to move a session. Nothing changes on the session until
 * the other participant approves.
 *
 * Order: authorisation, session state, idempotency, validation, lead time,
 * notice policy, fee acknowledgement, conflict recheck. Unknown sessions are
 * reported as `NOT_AUTHORIZED` so ids cannot be probed.
 */
export function proposeReschedule(
  ledger: SessionLedger,
  input: ProposeRescheduleInput,
  now: Date = new Date(),
): RescheduleResult {
  const { actor, policy } = input;
  const session = findSession(ledger, input.sessionId);

  if (
    !session ||
    (actor.role !== 'mentor' && actor.role !== 'mentee') ||
    !canScheduleForAgreement(actor, session)
  ) {
    return fail('NOT_AUTHORIZED');
  }
  if (session.status !== 'booked') return fail('SESSION_NOT_BOOKED');
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey ?? '')) return fail('IDEMPOTENCY_KEY_INVALID');

  const { issues, startsAt } = validateChange(session, input.proposedStartsAt, input.reason);
  const reason = (input.reason ?? '').trim();
  const scopedKey = `${actor.userId}|reschedule|${session.sessionId}|${input.idempotencyKey}`;
  const fingerprint = JSON.stringify([session.sessionId, startsAt, reason, input.acknowledgedFeeMinor]);

  const prior = ledger.idempotency[scopedKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) return fail('IDEMPOTENCY_KEY_REUSED');
    const existing = ledger.proposals.find((proposal) => proposal.proposalId === prior.proposalId);
    if (existing) return { ok: true, ledger, proposal: existing, session, replayed: true };
  }

  if (issues.length > 0 || !startsAt) return fail('INVALID_SESSION', issues);

  if (Date.parse(startsAt) - now.getTime() < policy.leadTimeMinutes * MINUTES) {
    return fail('LEAD_TIME_VIOLATION');
  }

  const preview = previewRescheduleConsequences({
    currentStartsAt: session.startsAt,
    amountMinor: input.amountMinor,
    requesterRole: actor.role,
    policy,
    now,
  });
  if (preview.blocked) return fail('RESCHEDULE_NOTICE_VIOLATION');
  if (input.acknowledgedFeeMinor !== preview.feeMinor) return fail('PAYMENT_PREVIEW_MISMATCH');

  if (
    hasSessionConflict(
      ledger.sessions,
      { mentorId: session.mentorId, menteeId: session.menteeId },
      newRange(session, startsAt),
      policy.bufferMinutes,
      session.sessionId,
    )
  ) {
    return fail('SLOT_CONFLICT');
  }

  const proposalId = `rsp-${stableHash(scopedKey)}`;
  const range = newRange(session, startsAt);
  const proposal: RescheduleProposal = {
    proposalId,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    tenantId: session.tenantId,
    proposedBy: actor.userId,
    baseRevision: session.revision,
    currentStartsAt: session.startsAt,
    proposedStartsAt: startsAt,
    proposedEndsAt: new Date(range.endMs).toISOString(),
    reason,
    status: 'pending',
    feeMinor: preview.feeMinor,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + policy.approvalTtlHours * HOUR_MS).toISOString(),
  };

  const event = eventFor('mentorship.session.reschedule_proposed', session, actor.userId, proposalId, now, {
    startsAt,
    endsAt: proposal.proposedEndsAt,
    previousStartsAt: session.startsAt,
  });

  const next = createSessionLedger({
    sessions: ledger.sessions,
    proposals: [...closeSuperseded(ledger.proposals, session.sessionId, proposalId, now), proposal],
    idempotency: { ...ledger.idempotency, [scopedKey]: { fingerprint, sessionId: session.sessionId, proposalId } },
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, proposal, session, event, replayed: false };
}

export type RescheduleDecision = 'approve' | 'decline' | 'withdraw';

export interface DecideRescheduleInput {
  actor: SchedulingActor;
  proposalId: string;
  decision: RescheduleDecision;
  policy: Pick<ReschedulePolicy, 'leadTimeMinutes' | 'bufferMinutes'>;
}

const DECISION_STATUS: Record<RescheduleDecision, RescheduleProposal['status']> = {
  approve: 'approved',
  decline: 'declined',
  withdraw: 'withdrawn',
};

function commitChange(
  ledger: SessionLedger,
  session: MentorshipSession,
  proposal: RescheduleProposal,
  approvedBy: string,
  override: boolean,
  now: Date,
): RescheduleResult & { ok: true } {
  const moved: MentorshipSession = {
    ...session,
    startsAt: proposal.proposedStartsAt,
    endsAt: proposal.proposedEndsAt,
    revision: session.revision + 1,
    timeChanges: [
      ...session.timeChanges,
      {
        proposalId: proposal.proposalId,
        fromStartsAt: session.startsAt,
        toStartsAt: proposal.proposedStartsAt,
        changedAt: now.toISOString(),
        requestedBy: proposal.proposedBy,
        approvedBy,
        reason: proposal.reason,
        override,
      },
    ],
  };
  const settled: RescheduleProposal = {
    ...proposal,
    status: 'approved',
    decidedAt: now.toISOString(),
    decidedBy: approvedBy,
  };
  const event = eventFor('mentorship.session.rescheduled', moved, approvedBy, proposal.proposalId, now, {
    previousStartsAt: session.startsAt,
  });
  const next = createSessionLedger({
    sessions: ledger.sessions.map((candidate) => (candidate.sessionId === session.sessionId ? moved : candidate)),
    proposals: [
      ...closeSuperseded(ledger.proposals, session.sessionId, proposal.proposalId, now).filter(
        (candidate) => candidate.proposalId !== proposal.proposalId,
      ),
      settled,
    ],
    idempotency: ledger.idempotency,
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, proposal: settled, session: moved, event, replayed: false };
}

/**
 * The other participant approves or declines, or the requester withdraws.
 *
 * An approval is only valid against the exact session state it was asked for.
 * If the session moved, was cancelled or the request was replaced in the
 * meantime the approval fails as stale rather than applying an old time. The
 * new time is rechecked for lead time and conflicts at approval, not just at
 * request. Repeating a decision that already took effect returns the same
 * result and mints no second event.
 */
export function decideReschedule(
  ledger: SessionLedger,
  input: DecideRescheduleInput,
  now: Date = new Date(),
): RescheduleResult {
  const { actor, decision, policy } = input;
  const proposal = ledger.proposals.find((candidate) => candidate.proposalId === input.proposalId);
  const session = proposal ? findSession(ledger, proposal.sessionId) : undefined;

  if (!proposal || !session || (actor.role !== 'mentor' && actor.role !== 'mentee') || !canScheduleForAgreement(actor, session)) {
    return fail('NOT_AUTHORIZED');
  }

  const isRequester = proposal.proposedBy === actor.userId;
  if (decision === 'withdraw' ? !isRequester : isRequester) return fail('APPROVAL_NOT_ALLOWED');

  if (proposal.status === DECISION_STATUS[decision]) {
    return { ok: true, ledger, proposal, session, replayed: true };
  }
  if (proposal.status === 'superseded') return fail('PROPOSAL_STALE');
  if (proposal.status === 'expired') return fail('PROPOSAL_EXPIRED');
  if (proposal.status !== 'pending') return fail('PROPOSAL_NOT_PENDING');
  if (now.getTime() >= Date.parse(proposal.expiresAt)) return fail('PROPOSAL_EXPIRED');
  if (session.status !== 'booked' || session.revision !== proposal.baseRevision) return fail('PROPOSAL_STALE');

  if (decision === 'approve') {
    if (Date.parse(proposal.proposedStartsAt) - now.getTime() < policy.leadTimeMinutes * MINUTES) {
      return fail('LEAD_TIME_VIOLATION');
    }
    if (
      hasSessionConflict(
        ledger.sessions,
        { mentorId: session.mentorId, menteeId: session.menteeId },
        newRange(session, proposal.proposedStartsAt),
        policy.bufferMinutes,
        session.sessionId,
      )
    ) {
      return fail('SLOT_CONFLICT');
    }
    return commitChange(ledger, session, proposal, actor.userId, false, now);
  }

  const closed: RescheduleProposal = {
    ...proposal,
    status: DECISION_STATUS[decision],
    decidedAt: now.toISOString(),
    decidedBy: actor.userId,
  };
  const event = eventFor('mentorship.session.reschedule_closed', session, actor.userId, proposal.proposalId, now, {
    outcome: decision === 'decline' ? 'declined' : 'withdrawn',
  });
  const next = createSessionLedger({
    sessions: ledger.sessions,
    proposals: ledger.proposals.map((candidate) => (candidate.proposalId === proposal.proposalId ? closed : candidate)),
    idempotency: ledger.idempotency,
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, proposal: closed, session, event, replayed: false };
}

export interface ApplyRescheduleInput {
  actor: SchedulingActor;
  sessionId: string;
  proposedStartsAt: string;
  reason: string;
  idempotencyKey: string;
  policy: Pick<ReschedulePolicy, 'leadTimeMinutes' | 'bufferMinutes'>;
}

/**
 * A coordinator or administrator applies a change directly. The reason is
 * mandatory and the change is recorded as an override, with no fee. Lead time
 * and conflicts are still enforced.
 */
export function applyReschedule(
  ledger: SessionLedger,
  input: ApplyRescheduleInput,
  now: Date = new Date(),
): RescheduleResult {
  const { actor, policy } = input;
  const session = findSession(ledger, input.sessionId);
  if (
    !session ||
    (actor.role !== 'coordinator' && actor.role !== 'administrator') ||
    !canScheduleForAgreement(actor, session)
  ) {
    return fail('NOT_AUTHORIZED');
  }
  if (session.status !== 'booked') return fail('SESSION_NOT_BOOKED');
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey ?? '')) return fail('IDEMPOTENCY_KEY_INVALID');

  const { issues, startsAt } = validateChange(session, input.proposedStartsAt, input.reason);
  const reason = (input.reason ?? '').trim();
  const scopedKey = `${actor.userId}|apply|${session.sessionId}|${input.idempotencyKey}`;
  const fingerprint = JSON.stringify([session.sessionId, startsAt, reason]);

  const prior = ledger.idempotency[scopedKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) return fail('IDEMPOTENCY_KEY_REUSED');
    const existing = ledger.proposals.find((proposal) => proposal.proposalId === prior.proposalId);
    const current = findSession(ledger, session.sessionId) ?? session;
    if (existing) return { ok: true, ledger, proposal: existing, session: current, replayed: true };
  }

  if (issues.length > 0 || !startsAt) return fail('INVALID_SESSION', issues);
  if (Date.parse(startsAt) - now.getTime() < policy.leadTimeMinutes * MINUTES) return fail('LEAD_TIME_VIOLATION');
  if (
    hasSessionConflict(
      ledger.sessions,
      { mentorId: session.mentorId, menteeId: session.menteeId },
      newRange(session, startsAt),
      policy.bufferMinutes,
      session.sessionId,
    )
  ) {
    return fail('SLOT_CONFLICT');
  }

  const proposalId = `rsp-${stableHash(scopedKey)}`;
  const range = newRange(session, startsAt);
  const direct: RescheduleProposal = {
    proposalId,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    tenantId: session.tenantId,
    proposedBy: actor.userId,
    baseRevision: session.revision,
    currentStartsAt: session.startsAt,
    proposedStartsAt: startsAt,
    proposedEndsAt: new Date(range.endMs).toISOString(),
    reason,
    status: 'pending',
    feeMinor: 0,
    createdAt: now.toISOString(),
    expiresAt: now.toISOString(),
  };

  const committed = commitChange(
    createSessionLedger({ ...ledger, proposals: [...ledger.proposals, direct] }),
    session,
    direct,
    actor.userId,
    true,
    now,
  );
  const withKey = createSessionLedger({
    ...committed.ledger,
    idempotency: { ...committed.ledger.idempotency, [scopedKey]: { fingerprint, sessionId: session.sessionId, proposalId } },
  });
  return { ...committed, ledger: withKey };
}

/**
 * Reason visibility: both participants and coordinators of the tenant see the
 * reason. Everyone else sees the request without it.
 */
export function redactProposalFor(
  proposal: RescheduleProposal,
  session: Pick<MentorshipSession, 'tenantId' | 'mentorId' | 'menteeId'>,
  viewer: SchedulingActor,
): RescheduleProposal | null {
  if (viewer.tenantId !== proposal.tenantId) return null;
  if (canScheduleForAgreement(viewer, session)) return proposal;
  return { ...proposal, reason: '' };
}

// ---------------------------------------------------------------------------
// Calendar convergence
// ---------------------------------------------------------------------------

export interface CalendarEntry {
  sessionId: string;
  revision: number;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export function calendarEntryOf(
  session: Pick<MentorshipSession, 'sessionId' | 'revision' | 'startsAt' | 'endsAt' | 'status'>,
): CalendarEntry {
  const { sessionId, revision, startsAt, endsAt, status } = session;
  return { sessionId, revision, startsAt, endsAt, status };
}

/**
 * Applies one update to a calendar. An update only wins if its revision is
 * higher, so stale, duplicated and out-of-order deliveries all converge on the
 * same final state: the one with the highest revision per session.
 */
export function applyCalendarUpdate(entries: readonly CalendarEntry[], update: CalendarEntry): CalendarEntry[] {
  const current = entries.find((entry) => entry.sessionId === update.sessionId);
  if (current && current.revision >= update.revision) return [...entries];
  return [...entries.filter((entry) => entry.sessionId !== update.sessionId), update].sort((a, b) =>
    a.sessionId.localeCompare(b.sessionId),
  );
}
