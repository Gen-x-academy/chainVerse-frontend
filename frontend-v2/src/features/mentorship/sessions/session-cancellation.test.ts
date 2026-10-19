import { describe, expect, it } from 'vitest';
import { calculateCancellation } from '../payments/cancellation-refunds';
import { bookSession } from './session-booking';
import {
  cancelSession,
  describeCancellationForParticipant,
  previewCancellation,
  redactCancellationFor,
  type CancelSessionInput,
  type CancelSessionResult,
} from './session-cancellation';
import { createSessionLedger, type SchedulingActor, type SessionLedger } from './session-core';
import { applyCalendarUpdate, calendarEntryOf, decideReschedule, proposeReschedule } from './session-reschedule';
import {
  FIXTURE_NEW_START,
  FIXTURE_NOW,
  FIXTURE_SLOT_START,
  MENTEE_ID,
  MENTOR_ID,
  SESSION_AMOUNT_MINOR,
  activeAgreement,
  bookedLedger,
  bookingInput,
  cancellationSnapshot,
  coordinatorActor,
  menteeActor,
  mentorActor,
  reschedulePolicy,
} from './test-fixtures';

const HOUR = 3_600_000;
const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

function ok(result: CancelSessionResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

function code(result: CancelSessionResult) {
  if (result.ok) throw new Error('expected an error');
  return result.error.code;
}

function cancel(
  ledger: SessionLedger,
  sessionId: string,
  overrides: Partial<CancelSessionInput> = {},
  now: Date = FIXTURE_NOW,
) {
  return cancelSession(
    ledger,
    {
      actor: menteeActor,
      sessionId,
      reasonCode: 'schedule_conflict',
      // 29 hours of notice falls in the 24 hour tier: half is refunded to a mentee.
      acknowledgedRefundMinor: 5000,
      amountMinor: SESSION_AMOUNT_MINOR,
      snapshot: cancellationSnapshot,
      idempotencyKey: 'cancel-key-0001',
      ...overrides,
    },
    now,
  );
}

describe('previewCancellation', () => {
  const preview = (role: Parameters<typeof previewCancellation>[0]['actorRole'], hours: number) =>
    previewCancellation({
      startsAt: new Date(FIXTURE_NOW.getTime() + hours * HOUR).toISOString(),
      amountMinor: SESSION_AMOUNT_MINOR,
      snapshot: cancellationSnapshot,
      actorRole: role,
      now: FIXTURE_NOW,
    });

  it('prices a mentee by notice tier, including the exact boundaries', () => {
    expect(preview('mentee', 72)).toMatchObject({ appliedRefundBps: 10_000, refundMinor: 10_000, cancelledBy: 'mentee' });
    expect(preview('mentee', 48)).toMatchObject({ appliedRefundBps: 10_000 });
    expect(preview('mentee', 47.9)).toMatchObject({ appliedRefundBps: 5_000, refundMinor: 5_000 });
    expect(preview('mentee', 24)).toMatchObject({ appliedRefundBps: 5_000 });
    expect(preview('mentee', 23.9)).toMatchObject({ appliedRefundBps: 0, refundMinor: 0 });
  });

  it('refunds a mentee in full when the mentor or a coordinator cancels, at any notice', () => {
    for (const role of ['mentor', 'coordinator', 'administrator'] as const) {
      expect(preview(role, 1)).toMatchObject({ appliedRefundBps: 10_000, refundMinor: 10_000 });
    }
    expect(preview('coordinator', 1).cancelledBy).toBe('platform');
  });

  it('agrees with the payments calculator and conserves the amount', () => {
    const result = preview('mentee', 29);
    const direct = calculateCancellation({
      policy: cancellationSnapshot.policy,
      amountMinor: SESSION_AMOUNT_MINOR,
      platformFeeBps: cancellationSnapshot.platformFeeBps,
      cancelledBy: 'mentee',
      noticeHours: result.noticeHours,
    });
    expect(result.refundMinor).toBe(direct.refundMinor);
    expect(result.mentorCompensationMinor).toBe(direct.mentorCompensationMinor);
    expect(result.platformFeeMinor).toBe(direct.platformFeeMinor);
    expect(result.refundMinor + result.mentorCompensationMinor + result.platformFeeMinor).toBe(SESSION_AMOUNT_MINOR);
  });

  it('reports the notice, and marks a session that has started', () => {
    expect(preview('mentee', 29).noticeHours).toBe(29);
    expect(preview('mentee', 29).started).toBe(false);
    expect(preview('mentee', -1)).toMatchObject({ started: true, noticeHours: 0 });
  });

  it('refuses a policy snapshot without a valid version', () => {
    expect(() =>
      previewCancellation({
        startsAt: FIXTURE_SLOT_START,
        amountMinor: 100,
        snapshot: { ...cancellationSnapshot, version: 0 },
        actorRole: 'mentee',
        now: FIXTURE_NOW,
      }),
    ).toThrow();
  });
});

describe('cancelSession', () => {
  it('cancels, records who, why, notice and the fee consequence', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(cancel(ledger, session.sessionId, { note: 'Clash with an exam' }));

    expect(result.replayed).toBe(false);
    expect(result.session).toMatchObject({ status: 'cancelled', revision: 2 });
    expect(result.cancellation).toMatchObject({
      cancelledAt: FIXTURE_NOW.toISOString(),
      cancelledBy: MENTEE_ID,
      cancelledByRole: 'mentee',
      reasonCode: 'schedule_conflict',
      note: 'Clash with an exam',
      noticeHours: 29,
      appliedRefundBps: 5000,
      refundMinor: 5000,
    });
  });

  it('records the policy id and version that priced it', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(cancel(ledger, session.sessionId));
    expect(result.cancellation).toMatchObject({ policyId: 'pol-standard', policyVersion: 3 });
    expect(result.settlement).toMatchObject({ policyId: 'pol-standard', policyVersion: 3 });
  });

  it('keeps the recorded policy even if the program changes it later', () => {
    const { ledger, session } = bookedLedger();
    const first = ok(cancel(ledger, session.sessionId));
    const newer = { ...cancellationSnapshot, version: 4, policy: { ...cancellationSnapshot.policy, tiers: [{ minNoticeHours: 0, refundBps: 0 }] } };
    const again = ok(cancel(first.ledger, session.sessionId, { snapshot: newer }));
    expect(again.cancellation.policyVersion).toBe(3);
    expect(again.cancellation.refundMinor).toBe(5000);
  });

  it('emits one canonical event with a category and no free text', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(cancel(ledger, session.sessionId, { note: 'Clash with an exam' }));
    const cancelled = result.ledger.events.filter((event) => event.type === 'mentorship.session.cancelled');

    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({
      revision: 2,
      reasonCode: 'schedule_conflict',
      cancelledByRole: 'mentee',
      settlementInstructionId: result.settlement.instructionId,
    });
    expect(JSON.stringify(cancelled[0])).not.toContain('exam');
  });

  it('sends exactly one settlement instruction carrying the priced amounts', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(cancel(ledger, session.sessionId));

    expect(result.ledger.settlements).toHaveLength(1);
    expect(result.settlement).toMatchObject({
      sessionId: session.sessionId,
      agreementId: 'agr-1',
      refundMinor: 5000,
      mentorCompensationMinor: result.cancellation.mentorCompensationMinor,
      platformFeeMinor: result.cancellation.platformFeeMinor,
    });
    expect(result.cancellation.settlementInstructionId).toBe(result.settlement.instructionId);
  });

  describe('authorization is deny by default', () => {
    it.each([
      ['an unrelated mentor', { userId: 'user-mentor-2', role: 'mentor' as const, tenantId: 'tenant-a' }],
      ['the wrong mentee', { userId: 'user-mentee-2', role: 'mentee' as const, tenantId: 'tenant-a' }],
      ['a participant from another tenant', { ...menteeActor, tenantId: 'tenant-b' }],
      ['a coordinator from another tenant', { ...coordinatorActor, tenantId: 'tenant-b' }],
    ])('refuses %s without changing anything', (_label, actor: SchedulingActor) => {
      const { ledger, session } = bookedLedger();
      expect(code(cancel(ledger, session.sessionId, { actor }))).toBe('NOT_AUTHORIZED');
      expect(ledger.settlements).toHaveLength(0);
      expect(ledger.sessions[0].status).toBe('booked');
    });

    it('answers an unknown session exactly like a forbidden one', () => {
      expect(code(cancel(bookedLedger().ledger, 'ses-nope'))).toBe('NOT_AUTHORIZED');
    });

    it('lets the mentor and a coordinator cancel', () => {
      const { ledger, session } = bookedLedger();
      expect(
        ok(cancel(ledger, session.sessionId, { actor: mentorActor, acknowledgedRefundMinor: 10_000 })).cancellation.cancelledByRole,
      ).toBe('mentor');
      expect(
        ok(
          cancel(ledger, session.sessionId, {
            actor: coordinatorActor,
            reasonCode: 'platform_action',
            acknowledgedRefundMinor: 10_000,
          }),
        ).cancellation.cancelledByRole,
      ).toBe('platform');
    });
  });

  describe('validation', () => {
    it('only lets coordinators use the platform reason', () => {
      const { ledger, session } = bookedLedger();
      expect(code(cancel(ledger, session.sessionId, { reasonCode: 'platform_action' }))).toBe('INVALID_SESSION');
      expect(code(cancel(ledger, session.sessionId, { reasonCode: 'made_up' as never }))).toBe('INVALID_SESSION');
    });

    it('requires a note for the other reason and keeps notes plain and short', () => {
      const { ledger, session } = bookedLedger();
      const other = cancel(ledger, session.sessionId, { reasonCode: 'other' });
      expect(code(other)).toBe('INVALID_SESSION');
      expect(code(cancel(ledger, session.sessionId, { note: 'x'.repeat(501) }))).toBe('INVALID_SESSION');
      expect(code(cancel(ledger, session.sessionId, { note: '<img src=x onerror=1>' }))).toBe('INVALID_SESSION');
      expect(cancel(ledger, session.sessionId, { reasonCode: 'other', note: 'Family matter' }).ok).toBe(true);
    });

    it('refuses an unusable policy instead of guessing a refund', () => {
      const { ledger, session } = bookedLedger();
      const bad = { ...cancellationSnapshot, policy: { id: 'bad', tiers: [] } };
      expect(code(cancel(ledger, session.sessionId, { snapshot: bad }))).toBe('INVALID_SESSION');
    });
  });

  it('refuses a session that has already started', () => {
    const { ledger, session } = bookedLedger();
    const after = new Date(Date.parse(FIXTURE_SLOT_START) + 60_000);
    expect(code(cancel(ledger, session.sessionId, {}, after))).toBe('SESSION_STARTED');
  });

  it('refuses a session that is not booked', () => {
    const { ledger, session } = bookedLedger();
    const done = createSessionLedger({ ...ledger, sessions: [{ ...session, status: 'completed' }] });
    expect(code(cancel(done, session.sessionId))).toBe('SESSION_NOT_BOOKED');
  });

  it('requires the refund the user saw to still be the refund priced', () => {
    const { ledger, session } = bookedLedger();
    expect(code(cancel(ledger, session.sessionId, { acknowledgedRefundMinor: 10_000 }))).toBe('PAYMENT_PREVIEW_MISMATCH');
    // Crossing into the next tier changes the price, so an old preview no longer matches.
    const later = new Date(Date.parse(FIXTURE_SLOT_START) - 20 * HOUR);
    expect(code(cancel(ledger, session.sessionId, {}, later))).toBe('PAYMENT_PREVIEW_MISMATCH');
    expect(cancel(ledger, session.sessionId, { acknowledgedRefundMinor: 0 }, later).ok).toBe(true);
  });

  describe('idempotency', () => {
    it('returns the original cancellation for a repeat with the same key', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(cancel(ledger, session.sessionId));
      const again = ok(cancel(first.ledger, session.sessionId));

      expect(again.replayed).toBe(true);
      expect(again.cancellation).toEqual(first.cancellation);
      expect(again.event).toBeUndefined();
      expect(again.ledger).toBe(first.ledger);
    });

    it('returns the original cancellation when retried with a new key', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(cancel(ledger, session.sessionId));
      const again = ok(cancel(first.ledger, session.sessionId, { idempotencyKey: 'cancel-key-0002' }));
      expect(again.replayed).toBe(true);
      expect(again.ledger.settlements).toHaveLength(1);
      expect(again.ledger.events.filter((event) => event.type === 'mentorship.session.cancelled')).toHaveLength(1);
    });

    it('rejects a key reused for different details', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(cancel(ledger, session.sessionId));
      expect(code(cancel(first.ledger, session.sessionId, { reasonCode: 'illness' }))).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it.each(['', 'short', 'has spaces in it'])('rejects the malformed key %j', (key) => {
      const { ledger, session } = bookedLedger();
      expect(code(cancel(ledger, session.sessionId, { idempotencyKey: key }))).toBe('IDEMPOTENCY_KEY_INVALID');
    });

    it('produces one event and one instruction when mentor and mentee cancel at the same moment', () => {
      const { ledger, session } = bookedLedger();
      const mentee = ok(cancel(ledger, session.sessionId, { idempotencyKey: 'cancel-key-mentee' }));
      const mentor = ok(
        cancel(mentee.ledger, session.sessionId, {
          actor: mentorActor,
          acknowledgedRefundMinor: 10_000,
          idempotencyKey: 'cancel-key-mentor',
        }),
      );

      expect(mentor.replayed).toBe(true);
      expect(mentor.cancellation.cancelledByRole).toBe('mentee');
      expect(mentor.ledger.settlements).toHaveLength(1);
      expect(mentor.ledger.events.filter((event) => event.type === 'mentorship.session.cancelled')).toHaveLength(1);
    });

    it('survives later bookings and reschedules without losing the instruction', () => {
      const { ledger, session } = bookedLedger();
      const cancelled = ok(cancel(ledger, session.sessionId));
      const rebooked = bookSession(
        cancelled.ledger,
        bookingInput({ idempotencyKey: 'book-key-0002', startsAt: '2026-11-05T14:00:00.000Z' }),
        FIXTURE_NOW,
      );
      if (!rebooked.ok) throw new Error('setup failed');
      expect(rebooked.ledger.settlements).toHaveLength(1);
    });
  });

  describe('capacity and slot reuse', () => {
    it('frees the slot at once so another booking can take it', () => {
      const { ledger, session } = bookedLedger();
      const blocked = bookSession(ledger, bookingInput({ idempotencyKey: 'book-key-0002' }), FIXTURE_NOW);
      expect(blocked.ok).toBe(false);

      const cancelled = ok(cancel(ledger, session.sessionId));
      const reused = bookSession(
        cancelled.ledger,
        bookingInput({
          actor: { userId: 'user-mentee-2', role: 'mentee', tenantId: 'tenant-a' },
          agreement: { ...activeAgreement, agreementId: 'agr-2', engagementId: 'eng-2', menteeId: 'user-mentee-2' },
          participants: { mentorId: MENTOR_ID, menteeId: 'user-mentee-2' },
          idempotencyKey: 'book-key-0003',
        }),
        FIXTURE_NOW,
      );
      expect(reused.ok).toBe(true);
    });

    it('still refuses to offer the freed slot again once it is inside the lead time', () => {
      const { ledger, session } = bookedLedger();
      const late = new Date(Date.parse(FIXTURE_SLOT_START) - 90 * 60_000);
      const cancelled = ok(cancel(ledger, session.sessionId, { acknowledgedRefundMinor: 0 }, late));
      const result = bookSession(cancelled.ledger, bookingInput({ idempotencyKey: 'book-key-0004' }), late);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('LEAD_TIME_VIOLATION');
    });
  });

  it('closes any pending reschedule request so it can no longer be approved', () => {
    const { ledger, session } = bookedLedger();
    const proposed = proposeReschedule(
      ledger,
      {
        actor: menteeActor,
        sessionId: session.sessionId,
        proposedStartsAt: FIXTURE_NEW_START,
        reason: 'An exam moved onto that afternoon',
        acknowledgedFeeMinor: 2500,
        amountMinor: SESSION_AMOUNT_MINOR,
        idempotencyKey: 'resch-key-0001',
        policy: reschedulePolicy,
      },
      FIXTURE_NOW,
    );
    if (!proposed.ok) throw new Error('setup failed');

    const cancelled = ok(cancel(proposed.ledger, session.sessionId));
    expect(cancelled.ledger.proposals[0].status).toBe('superseded');
    const approval = decideReschedule(
      cancelled.ledger,
      { actor: mentorActor, proposalId: proposed.proposal.proposalId, decision: 'approve', policy: { leadTimeMinutes: 120, bufferMinutes: 0 } },
      FIXTURE_NOW,
    );
    expect(approval.ok).toBe(false);
    if (!approval.ok) expect(approval.error.code).toBe('PROPOSAL_STALE');
  });

  it('lets the calendar converge on the cancelled state', () => {
    const { ledger, session } = bookedLedger();
    const cancelled = ok(cancel(ledger, session.sessionId));
    const calendar = [cancelled.session, session].reduce(
      (entries, item) => applyCalendarUpdate(entries, calendarEntryOf(item)),
      [] as ReturnType<typeof calendarEntryOf>[],
    );
    expect(calendar).toEqual([calendarEntryOf(cancelled.session)]);
    expect(calendar[0].status).toBe('cancelled');
  });
});

describe('describeCancellationForParticipant', () => {
  const run = () => {
    const { ledger, session } = bookedLedger();
    return ok(cancel(ledger, session.sessionId, { note: 'Clash with an exam' }));
  };

  it('tells the mentee who cancelled, when, why and what they get back', () => {
    const result = run();
    const notice = describeCancellationForParticipant(result.session, result.cancellation, 'mentee', 'America/New_York', money);
    expect(notice.subject).toBe('Session cancelled');
    expect(notice.body).toContain('The mentee cancelled');
    expect(notice.body).toContain('9:00 AM to 9:30 AM EST');
    expect(notice.body).toContain('14:00 to 14:30 UTC');
    expect(notice.body).toContain('Reason: Schedule conflict.');
    expect(notice.body).toContain('Note: Clash with an exam');
    expect(notice.body).toContain('You will be refunded $50.00.');
  });

  it('tells the mentor what they will be paid, or that nothing applies', () => {
    const result = run();
    const paid = describeCancellationForParticipant(result.session, result.cancellation, 'mentor', 'Europe/Berlin', money);
    expect(paid.body).toContain('3:00 PM to 3:30 PM');
    expect(paid.body).toContain(`You will be paid ${money(result.cancellation.mentorCompensationMinor)}`);

    const nothing = describeCancellationForParticipant(
      result.session,
      { ...result.cancellation, refundMinor: 0, mentorCompensationMinor: 0 },
      'mentee',
      'UTC',
      money,
    );
    expect(nothing.body).toContain('No refund applies');
  });
});

describe('note visibility', () => {
  it('shows the note to participants and coordinators of the tenant only', () => {
    const { ledger, session } = bookedLedger();
    const { cancellation } = ok(cancel(ledger, session.sessionId, { note: 'Clash with an exam' }));
    expect(redactCancellationFor(cancellation, session, mentorActor)?.note).toBe('Clash with an exam');
    expect(redactCancellationFor(cancellation, session, menteeActor)?.note).toBe('Clash with an exam');
    expect(redactCancellationFor(cancellation, session, coordinatorActor)?.note).toBe('Clash with an exam');
    expect(
      redactCancellationFor(cancellation, session, { userId: 'user-mentor-2', role: 'mentor', tenantId: 'tenant-a' })?.note,
    ).toBe('');
    expect(redactCancellationFor(cancellation, session, { ...coordinatorActor, tenantId: 'tenant-b' })).toBeNull();
  });
});
