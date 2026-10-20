/** MENTOR-058: cancel mentorship sessions. */

import {
  calculateCancellation,
  type CancellationPolicy,
  type CancelledBy,
  type RefundBreakdown,
} from '../payments/cancellation-refunds';
import { IDEMPOTENCY_KEY_PATTERN } from './session-booking';
import {
  CANCELLATION_REASON_LABELS,
  HOUR_MS,
  buildEventId,
  canScheduleForAgreement,
  createSessionLedger,
  formatLocalAndUtc,
  isSafePlainText,
  schedulingError,
  stableHash,
  supersedePendingProposals,
  type CancellationReasonCode,
  type MentorshipSession,
  type SchedulingActor,
  type SchedulingError,
  type SchedulingEvent,
  type SchedulingIssue,
  type SchedulingRole,
  type SessionCancellation,
  type SessionLedger,
  type SettlementInstruction,
} from './session-core';

/** The policy that applies to a session, frozen with its version so cancellations can be audited. */
export interface CancellationPolicySnapshot {
  policy: CancellationPolicy;
  /** Increments whenever the program changes the policy. */
  version: number;
  /** Platform commission on the amount kept after any refund, in basis points. */
  platformFeeBps: number;
}

export const NOTE_MIN_LENGTH = 5;
export const NOTE_MAX_LENGTH = 500;

const REASON_CODES = Object.keys(CANCELLATION_REASON_LABELS) as CancellationReasonCode[];

/** Mentees and mentors pick a reason; `platform_action` is for coordinators. */
export const PARTICIPANT_REASON_CODES: readonly CancellationReasonCode[] = REASON_CODES.filter(
  (code) => code !== 'platform_action',
);

export function cancelledByRole(role: SchedulingRole): CancelledBy {
  if (role === 'mentee') return 'mentee';
  if (role === 'mentor') return 'mentor';
  return 'platform';
}

export interface CancellationPreview extends RefundBreakdown {
  noticeHours: number;
  cancelledBy: CancelledBy;
  /** True when the session has already started, so it can no longer be cancelled. */
  started: boolean;
}

export interface PreviewCancellationInput {
  startsAt: string;
  amountMinor: number;
  snapshot: CancellationPolicySnapshot;
  actorRole: SchedulingRole;
  now: Date;
}

/**
 * Prices a cancellation before anyone commits to it. The same function prices
 * the real cancellation, so the preview and the settlement cannot disagree.
 * Throws if the policy snapshot is invalid, so a bad policy never prices a refund.
 */
export function previewCancellation(input: PreviewCancellationInput): CancellationPreview {
  const { snapshot } = input;
  if (!Number.isInteger(snapshot.version) || snapshot.version < 1) {
    throw new Error('A cancellation policy needs a version of at least 1');
  }
  const rawNotice = (Date.parse(input.startsAt) - input.now.getTime()) / HOUR_MS;
  const noticeHours = Math.max(0, rawNotice);
  const cancelledBy = cancelledByRole(input.actorRole);
  const breakdown = calculateCancellation({
    policy: snapshot.policy,
    amountMinor: input.amountMinor,
    platformFeeBps: snapshot.platformFeeBps,
    cancelledBy,
    noticeHours,
  });
  return { ...breakdown, noticeHours, cancelledBy, started: rawNotice <= 0 };
}

export interface CancelSessionInput {
  actor: SchedulingActor;
  sessionId: string;
  reasonCode: CancellationReasonCode;
  /** Optional free text; required when the reason is `other`. */
  note?: string;
  /** The refund shown in the preview. It must still match when the request is made. */
  acknowledgedRefundMinor: number;
  /** The session price from the payment snapshot, in minor units. */
  amountMinor: number;
  snapshot: CancellationPolicySnapshot;
  idempotencyKey: string;
}

export type CancelSessionResult =
  | {
      ok: true;
      ledger: SessionLedger;
      session: MentorshipSession;
      cancellation: SessionCancellation;
      settlement: SettlementInstruction;
      /** Present exactly once per session; absent on any replay. */
      event?: SchedulingEvent;
      replayed: boolean;
    }
  | { ok: false; error: SchedulingError };

function fail(
  code: Parameters<typeof schedulingError>[0],
  issues?: SchedulingIssue[],
): { ok: false; error: SchedulingError } {
  return { ok: false, error: schedulingError(code, issues) };
}

function validateReason(
  actor: SchedulingActor,
  reasonCode: unknown,
  note: string | undefined,
): SchedulingIssue[] {
  const issues: SchedulingIssue[] = [];
  const allowed =
    actor.role === 'coordinator' || actor.role === 'administrator' ? REASON_CODES : PARTICIPANT_REASON_CODES;
  if (typeof reasonCode !== 'string' || !(allowed as readonly string[]).includes(reasonCode)) {
    issues.push({ field: 'reasonCode', message: 'Choose a reason for the cancellation.' });
  }
  const trimmed = (note ?? '').trim();
  if (reasonCode === 'other' && trimmed.length < NOTE_MIN_LENGTH) {
    issues.push({ field: 'note', message: `Add a note of at least ${NOTE_MIN_LENGTH} characters.` });
  } else if (trimmed.length > NOTE_MAX_LENGTH) {
    issues.push({ field: 'note', message: `Keep the note to ${NOTE_MAX_LENGTH} characters or fewer.` });
  } else if (trimmed.length > 0 && !isSafePlainText(trimmed)) {
    issues.push({ field: 'note', message: 'The note must be plain text without markup.' });
  }
  return issues;
}

/**
 * Cancels a booked session.
 *
 * Order: authorisation, key format, idempotency, already cancelled, session
 * state, reason, start time, pricing, refund acknowledgement. An unknown
 * session is reported as `NOT_AUTHORIZED` so ids cannot be probed.
 *
 * Cancelling is idempotent in two ways. The same key returns the original
 * result, and cancelling a session that is already cancelled returns the
 * original cancellation whatever the key. Neither mints a second event or a
 * second settlement instruction, so two people cancelling at the same moment
 * still produce exactly one of each.
 *
 * The cancellation frees the slot at once. Whether it can be booked again is
 * still decided by the booking lead time, so a slot that starts too soon is not
 * offered again.
 */
export function cancelSession(
  ledger: SessionLedger,
  input: CancelSessionInput,
  now: Date = new Date(),
): CancelSessionResult {
  const { actor, snapshot } = input;
  const session = ledger.sessions.find((candidate) => candidate.sessionId === input.sessionId);

  if (!session || !canScheduleForAgreement(actor, session)) return fail('NOT_AUTHORIZED');
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey ?? '')) return fail('IDEMPOTENCY_KEY_INVALID');

  const note = (input.note ?? '').trim();
  const scopedKey = `${actor.userId}|cancel|${session.sessionId}|${input.idempotencyKey}`;
  const fingerprint = JSON.stringify([session.sessionId, input.reasonCode, note, input.acknowledgedRefundMinor]);

  const replay = (existing: MentorshipSession): CancelSessionResult => {
    const settlement = ledger.settlements.find(
      (candidate) => candidate.instructionId === existing.cancellation?.settlementInstructionId,
    );
    if (!existing.cancellation || !settlement) return fail('UNKNOWN');
    return { ok: true, ledger, session: existing, cancellation: existing.cancellation, settlement, replayed: true };
  };

  const prior = ledger.idempotency[scopedKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) return fail('IDEMPOTENCY_KEY_REUSED');
    return replay(session);
  }
  if (session.status === 'cancelled') return replay(session);
  if (session.status !== 'booked') return fail('SESSION_NOT_BOOKED');

  const issues = validateReason(actor, input.reasonCode, input.note);
  if (issues.length > 0) return fail('INVALID_SESSION', issues);

  let preview: CancellationPreview;
  try {
    preview = previewCancellation({
      startsAt: session.startsAt,
      amountMinor: input.amountMinor,
      snapshot,
      actorRole: actor.role,
      now,
    });
  } catch {
    return fail('INVALID_SESSION', [{ field: 'policy', message: 'The cancellation policy could not be applied.' }]);
  }
  if (preview.started) return fail('SESSION_STARTED');
  if (input.acknowledgedRefundMinor !== preview.refundMinor) return fail('PAYMENT_PREVIEW_MISMATCH');

  const instructionId = `stl-${stableHash(`settle|${session.sessionId}`)}`;
  const settlement: SettlementInstruction = {
    instructionId,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    tenantId: session.tenantId,
    policyId: snapshot.policy.id,
    policyVersion: snapshot.version,
    refundMinor: preview.refundMinor,
    mentorCompensationMinor: preview.mentorCompensationMinor,
    platformFeeMinor: preview.platformFeeMinor,
    createdAt: now.toISOString(),
  };
  const cancellation: SessionCancellation = {
    cancelledAt: now.toISOString(),
    cancelledBy: actor.userId,
    cancelledByRole: preview.cancelledBy,
    reasonCode: input.reasonCode,
    note,
    noticeHours: preview.noticeHours,
    policyId: snapshot.policy.id,
    policyVersion: snapshot.version,
    appliedRefundBps: preview.appliedRefundBps,
    refundMinor: preview.refundMinor,
    mentorCompensationMinor: preview.mentorCompensationMinor,
    platformFeeMinor: preview.platformFeeMinor,
    settlementInstructionId: instructionId,
  };
  const cancelled: MentorshipSession = {
    ...session,
    status: 'cancelled',
    revision: session.revision + 1,
    cancellation,
  };
  const event: SchedulingEvent = {
    eventId: buildEventId('mentorship.session.cancelled', cancelled.sessionId, cancelled.revision),
    type: 'mentorship.session.cancelled',
    sessionId: cancelled.sessionId,
    agreementId: cancelled.agreementId,
    engagementId: cancelled.engagementId,
    tenantId: cancelled.tenantId,
    revision: cancelled.revision,
    occurredAt: now.toISOString(),
    actorId: actor.userId,
    startsAt: cancelled.startsAt,
    endsAt: cancelled.endsAt,
    reasonCode: input.reasonCode,
    cancelledByRole: preview.cancelledBy,
    settlementInstructionId: instructionId,
  };

  const next = createSessionLedger({
    ...ledger,
    sessions: ledger.sessions.map((candidate) => (candidate.sessionId === session.sessionId ? cancelled : candidate)),
    proposals: supersedePendingProposals(ledger.proposals, session.sessionId, null, now),
    settlements: [...ledger.settlements, settlement],
    idempotency: { ...ledger.idempotency, [scopedKey]: { fingerprint, sessionId: session.sessionId } },
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, session: cancelled, cancellation, settlement, event, replayed: false };
}

export interface CancellationNotice {
  subject: string;
  body: string;
}

const ACTOR_LABEL: Record<CancelledBy, string> = {
  mentee: 'The mentee',
  mentor: 'The mentor',
  platform: 'A coordinator',
};

/**
 * The message each participant receives. It states who cancelled, when the
 * session was, the reason category and what it means for that recipient's
 * money, with the time in the recipient's zone and in UTC.
 */
export function describeCancellationForParticipant(
  session: Pick<MentorshipSession, 'startsAt' | 'endsAt'>,
  cancellation: SessionCancellation,
  recipient: 'mentor' | 'mentee',
  timeZone: string,
  formatMoney: (amountMinor: number) => string,
): CancellationNotice {
  const time = formatLocalAndUtc(session.startsAt, session.endsAt, timeZone);
  const lines = [
    `${ACTOR_LABEL[cancellation.cancelledByRole]} cancelled the session scheduled for ${time.local} (${time.utc}).`,
    `Reason: ${CANCELLATION_REASON_LABELS[cancellation.reasonCode]}.`,
  ];
  if (cancellation.note) lines.push(`Note: ${cancellation.note}`);
  if (recipient === 'mentee') {
    lines.push(
      cancellation.refundMinor > 0
        ? `You will be refunded ${formatMoney(cancellation.refundMinor)}.`
        : 'No refund applies under the cancellation policy.',
    );
  } else {
    lines.push(
      cancellation.mentorCompensationMinor > 0
        ? `You will be paid ${formatMoney(cancellation.mentorCompensationMinor)} for this session.`
        : 'No payment applies for this session.',
    );
  }
  return { subject: 'Session cancelled', body: lines.join(' ') };
}

/**
 * The note is visible to both participants and coordinators of the tenant.
 * Everyone else in the tenant sees the cancellation without it, and other
 * tenants see nothing.
 */
export function redactCancellationFor(
  cancellation: SessionCancellation,
  session: Pick<MentorshipSession, 'tenantId' | 'mentorId' | 'menteeId'>,
  viewer: SchedulingActor,
): SessionCancellation | null {
  if (viewer.tenantId !== session.tenantId) return null;
  if (canScheduleForAgreement(viewer, session)) return cancellation;
  return { ...cancellation, note: '' };
}
