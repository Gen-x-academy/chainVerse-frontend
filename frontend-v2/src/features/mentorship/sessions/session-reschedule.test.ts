import { describe, expect, it } from 'vitest';
import { bookSession } from './session-booking';
import {
  createSessionLedger,
  type MentorshipSession,
  type SchedulingActor,
  type SessionLedger,
} from './session-core';
import {
  applyCalendarUpdate,
  applyReschedule,
  calendarEntryOf,
  decideReschedule,
  previewRescheduleConsequences,
  proposeReschedule,
  redactProposalFor,
  type CalendarEntry,
  type ProposeRescheduleInput,
  type RescheduleResult,
} from './session-reschedule';
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
  coordinatorActor,
  menteeActor,
  mentorActor,
  reschedulePolicy,
} from './test-fixtures';

const REASON = 'An exam moved onto that afternoon';
const HOUR = 3_600_000;

function ok(result: RescheduleResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

function code(result: RescheduleResult) {
  if (result.ok) throw new Error('expected an error');
  return result.error.code;
}

function propose(
  ledger: SessionLedger,
  sessionId: string,
  overrides: Partial<ProposeRescheduleInput> = {},
  now: Date = FIXTURE_NOW,
) {
  return proposeReschedule(
    ledger,
    {
      actor: menteeActor,
      sessionId,
      proposedStartsAt: FIXTURE_NEW_START,
      reason: REASON,
      // 29 hours of notice is under the free window, so a mentee owes 25%.
      acknowledgedFeeMinor: 2500,
      amountMinor: SESSION_AMOUNT_MINOR,
      idempotencyKey: 'resch-key-0001',
      policy: reschedulePolicy,
      ...overrides,
    },
    now,
  );
}

const decidePolicy = { leadTimeMinutes: 120, bufferMinutes: 0 };

function pendingFixture() {
  const { ledger, session } = bookedLedger();
  const proposed = ok(propose(ledger, session.sessionId));
  return { ledger: proposed.ledger, session, proposal: proposed.proposal };
}

describe('previewRescheduleConsequences', () => {
  const preview = (role: Parameters<typeof previewRescheduleConsequences>[0]['requesterRole'], hours: number, amount = 10_000) =>
    previewRescheduleConsequences({
      currentStartsAt: new Date(FIXTURE_NOW.getTime() + hours * HOUR).toISOString(),
      amountMinor: amount,
      requesterRole: role,
      policy: reschedulePolicy,
      now: FIXTURE_NOW,
    });

  it('charges a mentee a late fee between the minimum and the free notice', () => {
    expect(preview('mentee', 29)).toMatchObject({ late: true, blocked: false, payer: 'mentee', feeMinor: 2500 });
  });

  it('never charges a mentor or a coordinator', () => {
    expect(preview('mentor', 29)).toMatchObject({ late: true, payer: 'none', feeMinor: 0 });
    expect(preview('coordinator', 29)).toMatchObject({ payer: 'none', feeMinor: 0 });
  });

  it('is free at or beyond the free notice, exactly at the boundary included', () => {
    expect(preview('mentee', 48)).toMatchObject({ late: false, feeMinor: 0, payer: 'none' });
    expect(preview('mentee', 47.99).late).toBe(true);
  });

  it('blocks participants below the minimum notice but not coordinators', () => {
    expect(preview('mentee', 12).blocked).toBe(false);
    expect(preview('mentee', 11.9)).toMatchObject({ blocked: true, feeMinor: 0 });
    expect(preview('mentor', 1).blocked).toBe(true);
    expect(preview('administrator', 1).blocked).toBe(false);
  });

  it('explains the result in words and rounds the fee to whole minor units', () => {
    const result = preview('mentee', 29, 999);
    expect(result.feeMinor).toBe(250);
    expect(result.explanation.join(' ')).toContain('25%');
    expect(result.explanation[0]).toContain('29 hours');
  });

  it('rejects an invalid amount or fee rate instead of guessing', () => {
    expect(() => preview('mentee', 29, -1)).toThrow();
    expect(() => preview('mentee', 29, 1.5)).toThrow();
    expect(() =>
      previewRescheduleConsequences({
        currentStartsAt: FIXTURE_SLOT_START,
        amountMinor: 100,
        requesterRole: 'mentee',
        policy: { ...reschedulePolicy, lateFeeBps: 10_001 },
        now: FIXTURE_NOW,
      }),
    ).toThrow();
  });
});

describe('proposeReschedule', () => {
  it('records a pending request and leaves the session untouched until approval', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(propose(ledger, session.sessionId));

    expect(result.replayed).toBe(false);
    expect(result.proposal).toMatchObject({
      status: 'pending',
      proposedBy: MENTEE_ID,
      baseRevision: 1,
      currentStartsAt: FIXTURE_SLOT_START,
      proposedStartsAt: FIXTURE_NEW_START,
      proposedEndsAt: '2026-11-04T15:30:00.000Z',
      feeMinor: 2500,
      reason: REASON,
    });
    expect(result.ledger.sessions[0]).toEqual(session);
  });

  it('emits one event that carries no reason text', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(propose(ledger, session.sessionId));

    expect(result.ledger.events).toHaveLength(2);
    expect(result.event).toMatchObject({
      type: 'mentorship.session.reschedule_proposed',
      proposalId: result.proposal.proposalId,
      previousStartsAt: FIXTURE_SLOT_START,
      startsAt: FIXTURE_NEW_START,
    });
    expect(JSON.stringify(result.event)).not.toContain('exam');
  });

  it.each([
    ['an unrelated mentor', { userId: 'user-mentor-2', role: 'mentor' as const, tenantId: 'tenant-a' }],
    ['the wrong mentee', { userId: 'user-mentee-2', role: 'mentee' as const, tenantId: 'tenant-a' }],
    ['a participant from another tenant', { ...menteeActor, tenantId: 'tenant-b' }],
    ['a coordinator, who must use apply', coordinatorActor],
  ])('refuses %s', (_label, actor: SchedulingActor) => {
    const { ledger, session } = bookedLedger();
    expect(code(propose(ledger, session.sessionId, { actor }))).toBe('NOT_AUTHORIZED');
  });

  it('answers an unknown session exactly like a forbidden one so ids cannot be probed', () => {
    const { ledger } = bookedLedger();
    expect(code(propose(ledger, 'ses-does-not-exist'))).toBe('NOT_AUTHORIZED');
  });

  it('only changes a booked session', () => {
    const { ledger, session } = bookedLedger();
    const cancelled = createSessionLedger({
      ...ledger,
      sessions: [{ ...session, status: 'cancelled' }],
    });
    expect(code(propose(cancelled, session.sessionId))).toBe('SESSION_NOT_BOOKED');
  });

  it('validates the new time and the reason together', () => {
    const { ledger, session } = bookedLedger();
    const result = propose(ledger, session.sessionId, {
      proposedStartsAt: FIXTURE_SLOT_START,
      reason: 'no',
    });
    expect(code(result)).toBe('INVALID_SESSION');
    if (!result.ok) {
      expect(result.error.issues?.map((issue) => issue.field).sort()).toEqual(['proposedStartsAt', 'reason']);
    }
    expect(code(propose(ledger, session.sessionId, { proposedStartsAt: 'soon' }))).toBe('INVALID_SESSION');
    expect(code(propose(ledger, session.sessionId, { reason: 'x'.repeat(501) }))).toBe('INVALID_SESSION');
    expect(code(propose(ledger, session.sessionId, { reason: '<script>alert(1)</script>' }))).toBe('INVALID_SESSION');
  });

  it('refuses a new time inside the lead time', () => {
    const { ledger, session } = bookedLedger();
    expect(
      code(propose(ledger, session.sessionId, { proposedStartsAt: '2026-11-02T10:30:00.000Z' })),
    ).toBe('LEAD_TIME_VIOLATION');
  });

  it('enforces the minimum notice for participants', () => {
    const { ledger, session } = bookedLedger();
    const tooLate = new Date(Date.parse(FIXTURE_SLOT_START) - 6 * HOUR);
    expect(code(propose(ledger, session.sessionId, { acknowledgedFeeMinor: 0 }, tooLate))).toBe(
      'RESCHEDULE_NOTICE_VIOLATION',
    );
  });

  it('requires the fee the user was shown to still be the fee charged', () => {
    const { ledger, session } = bookedLedger();
    expect(code(propose(ledger, session.sessionId, { acknowledgedFeeMinor: 0 }))).toBe('PAYMENT_PREVIEW_MISMATCH');
    expect(code(propose(ledger, session.sessionId, { acknowledgedFeeMinor: 2501 }))).toBe('PAYMENT_PREVIEW_MISMATCH');
  });

  it('charges nothing to a mentor and needs no acknowledgement', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(propose(ledger, session.sessionId, { actor: mentorActor, acknowledgedFeeMinor: 0 }));
    expect(result.proposal.feeMinor).toBe(0);
  });

  it('is free for a mentee with plenty of notice', () => {
    const { ledger, session } = bookedLedger('2026-11-06T14:00:00.000Z');
    const result = ok(
      propose(ledger, session.sessionId, { acknowledgedFeeMinor: 0, proposedStartsAt: '2026-11-07T14:00:00.000Z' }),
    );
    expect(result.proposal.feeMinor).toBe(0);
  });

  it('rechecks conflicts for the new time', () => {
    const { ledger, session } = bookedLedger();
    const clash = bookSession(
      ledger,
      bookingInput({
        actor: { userId: 'user-mentee-2', role: 'mentee', tenantId: 'tenant-a' },
        agreement: { ...activeAgreement, agreementId: 'agr-2', engagementId: 'eng-2', menteeId: 'user-mentee-2' },
        participants: { mentorId: MENTOR_ID, menteeId: 'user-mentee-2' },
        startsAt: FIXTURE_NEW_START,
        idempotencyKey: 'book-key-other-1',
      }),
      FIXTURE_NOW,
    );
    if (!clash.ok) throw new Error('setup failed');
    expect(code(propose(clash.ledger, session.sessionId))).toBe('SLOT_CONFLICT');
  });

  it('does not conflict with its own current slot', () => {
    const { ledger, session } = bookedLedger();
    const result = propose(ledger, session.sessionId, { proposedStartsAt: '2026-11-03T14:15:00.000Z' });
    expect(result.ok).toBe(true);
  });

  describe('idempotency', () => {
    it('returns the same request for a repeat and mints no second event', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(propose(ledger, session.sessionId));
      const again = ok(propose(first.ledger, session.sessionId));

      expect(again.replayed).toBe(true);
      expect(again.proposal).toEqual(first.proposal);
      expect(again.event).toBeUndefined();
      expect(again.ledger).toBe(first.ledger);
      expect(again.ledger.events).toHaveLength(2);
    });

    it('rejects a key reused for a different time', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(propose(ledger, session.sessionId));
      expect(
        code(propose(first.ledger, session.sessionId, { proposedStartsAt: '2026-11-05T15:00:00.000Z' })),
      ).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it.each(['', 'short', 'has spaces in it'])('rejects the malformed key %j', (key) => {
      const { ledger, session } = bookedLedger();
      expect(code(propose(ledger, session.sessionId, { idempotencyKey: key }))).toBe('IDEMPOTENCY_KEY_INVALID');
    });
  });

  it('supersedes an earlier pending request so only one can be approved', () => {
    const { ledger, session } = bookedLedger();
    const first = ok(propose(ledger, session.sessionId));
    const second = ok(
      propose(first.ledger, session.sessionId, {
        proposedStartsAt: '2026-11-05T15:00:00.000Z',
        idempotencyKey: 'resch-key-0002',
      }),
    );

    const statuses = Object.fromEntries(second.ledger.proposals.map((p) => [p.proposalId, p.status]));
    expect(statuses[first.proposal.proposalId]).toBe('superseded');
    expect(statuses[second.proposal.proposalId]).toBe('pending');
    expect(
      code(decideReschedule(second.ledger, { actor: mentorActor, proposalId: first.proposal.proposalId, decision: 'approve', policy: decidePolicy }, FIXTURE_NOW)),
    ).toBe('PROPOSAL_STALE');
  });
});

describe('decideReschedule', () => {
  const approve = (ledger: SessionLedger, proposalId: string, now: Date = FIXTURE_NOW, actor: SchedulingActor = mentorActor) =>
    decideReschedule(ledger, { actor, proposalId, decision: 'approve', policy: decidePolicy }, now);

  it('moves the session when the other participant approves and traces the original time', () => {
    const { ledger, proposal } = pendingFixture();
    const result = ok(approve(ledger, proposal.proposalId));

    expect(result.session).toMatchObject({
      startsAt: FIXTURE_NEW_START,
      endsAt: '2026-11-04T15:30:00.000Z',
      originalStartsAt: FIXTURE_SLOT_START,
      revision: 2,
      status: 'booked',
    });
    expect(result.session.timeChanges).toEqual([
      {
        proposalId: proposal.proposalId,
        fromStartsAt: FIXTURE_SLOT_START,
        toStartsAt: FIXTURE_NEW_START,
        changedAt: FIXTURE_NOW.toISOString(),
        requestedBy: MENTEE_ID,
        approvedBy: MENTOR_ID,
        reason: REASON,
        override: false,
      },
    ]);
    expect(result.proposal).toMatchObject({ status: 'approved', decidedBy: MENTOR_ID });
  });

  it('emits exactly one rescheduled event with the new revision', () => {
    const { ledger, proposal } = pendingFixture();
    const result = ok(approve(ledger, proposal.proposalId));
    const rescheduled = result.ledger.events.filter((event) => event.type === 'mentorship.session.rescheduled');

    expect(rescheduled).toHaveLength(1);
    expect(rescheduled[0]).toMatchObject({
      revision: 2,
      previousStartsAt: FIXTURE_SLOT_START,
      startsAt: FIXTURE_NEW_START,
      actorId: MENTOR_ID,
    });
    expect(JSON.stringify(rescheduled[0])).not.toContain('exam');
  });

  it('keeps every move traceable back to the first booking', () => {
    const { ledger, proposal } = pendingFixture();
    const first = ok(approve(ledger, proposal.proposalId));
    const second = ok(
      proposeReschedule(
        first.ledger,
        {
          actor: mentorActor,
          sessionId: first.session.sessionId,
          proposedStartsAt: '2026-11-06T10:00:00.000Z',
          reason: 'Travelling that week',
          acknowledgedFeeMinor: 0,
          amountMinor: SESSION_AMOUNT_MINOR,
          idempotencyKey: 'resch-key-0002',
          policy: reschedulePolicy,
        },
        FIXTURE_NOW,
      ),
    );
    const moved = ok(approve(second.ledger, second.proposal.proposalId, FIXTURE_NOW, menteeActor));

    expect(moved.session.originalStartsAt).toBe(FIXTURE_SLOT_START);
    expect(moved.session.revision).toBe(3);
    expect(moved.session.timeChanges.map((change) => [change.fromStartsAt, change.toStartsAt])).toEqual([
      [FIXTURE_SLOT_START, FIXTURE_NEW_START],
      [FIXTURE_NEW_START, '2026-11-06T10:00:00.000Z'],
    ]);
  });

  describe('who may answer', () => {
    it('stops the requester from approving or declining their own request', () => {
      const { ledger, proposal } = pendingFixture();
      expect(code(approve(ledger, proposal.proposalId, FIXTURE_NOW, menteeActor))).toBe('APPROVAL_NOT_ALLOWED');
      expect(
        code(decideReschedule(ledger, { actor: menteeActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW)),
      ).toBe('APPROVAL_NOT_ALLOWED');
    });

    it('stops the other participant from withdrawing someone else request', () => {
      const { ledger, proposal } = pendingFixture();
      expect(
        code(decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'withdraw', policy: decidePolicy }, FIXTURE_NOW)),
      ).toBe('APPROVAL_NOT_ALLOWED');
    });

    it.each([
      ['an unrelated mentor', { userId: 'user-mentor-2', role: 'mentor' as const, tenantId: 'tenant-a' }],
      ['another tenant', { ...mentorActor, tenantId: 'tenant-b' }],
      ['a coordinator', coordinatorActor],
    ])('refuses %s', (_label, actor: SchedulingActor) => {
      const { ledger, proposal } = pendingFixture();
      expect(code(approve(ledger, proposal.proposalId, FIXTURE_NOW, actor))).toBe('NOT_AUTHORIZED');
    });

    it('answers an unknown request like a forbidden one', () => {
      const { ledger } = pendingFixture();
      expect(code(approve(ledger, 'rsp-nope'))).toBe('NOT_AUTHORIZED');
    });
  });

  describe('stale approvals fail', () => {
    it('fails when a coordinator already moved the session', () => {
      const { ledger, session, proposal } = pendingFixture();
      const moved = ok(
        applyReschedule(
          ledger,
          {
            actor: coordinatorActor,
            sessionId: session.sessionId,
            proposedStartsAt: '2026-11-08T10:00:00.000Z',
            reason: 'Room change by the school',
            idempotencyKey: 'apply-key-0001',
            policy: decidePolicy,
          },
          FIXTURE_NOW,
        ),
      );
      // The coordinator change superseded the pending request.
      expect(code(approve(moved.ledger, proposal.proposalId))).toBe('PROPOSAL_STALE');
    });

    it('fails when the session was cancelled after the request', () => {
      const { ledger, session, proposal } = pendingFixture();
      const cancelled = createSessionLedger({
        ...ledger,
        sessions: ledger.sessions.map((candidate): MentorshipSession =>
          candidate.sessionId === session.sessionId ? { ...candidate, status: 'cancelled', revision: 2 } : candidate,
        ),
      });
      expect(code(approve(cancelled, proposal.proposalId))).toBe('PROPOSAL_STALE');
    });

    it('fails when the session revision moved on', () => {
      const { ledger, session, proposal } = pendingFixture();
      const changed = createSessionLedger({
        ...ledger,
        sessions: ledger.sessions.map((candidate): MentorshipSession =>
          candidate.sessionId === session.sessionId ? { ...candidate, revision: 5 } : candidate,
        ),
      });
      expect(code(approve(changed, proposal.proposalId))).toBe('PROPOSAL_STALE');
    });

    it('fails once the request has expired, exactly at the deadline included', () => {
      const { ledger, proposal } = pendingFixture();
      const deadline = Date.parse(proposal.expiresAt);
      expect(code(approve(ledger, proposal.proposalId, new Date(deadline)))).toBe('PROPOSAL_EXPIRED');
      expect(code(approve(ledger, proposal.proposalId, new Date(deadline + HOUR)))).toBe('PROPOSAL_EXPIRED');
      expect(approve(ledger, proposal.proposalId, new Date(deadline - 1)).ok).toBe(true);
    });
  });

  describe('rechecks at approval', () => {
    it('refuses when another session took the new slot in the meantime', () => {
      const { ledger, proposal } = pendingFixture();
      const taken = bookSession(
        ledger,
        bookingInput({
          actor: { userId: 'user-mentee-2', role: 'mentee', tenantId: 'tenant-a' },
          agreement: { ...activeAgreement, agreementId: 'agr-2', engagementId: 'eng-2', menteeId: 'user-mentee-2' },
          participants: { mentorId: MENTOR_ID, menteeId: 'user-mentee-2' },
          startsAt: FIXTURE_NEW_START,
          idempotencyKey: 'book-key-other-2',
        }),
        FIXTURE_NOW,
      );
      if (!taken.ok) throw new Error('setup failed');
      expect(code(approve(taken.ledger, proposal.proposalId))).toBe('SLOT_CONFLICT');
    });

    it('refuses when the new time is now inside the lead time', () => {
      const { ledger: base, session } = bookedLedger();
      const { ledger, proposal } = ok(
        propose(base, session.sessionId, { policy: { ...reschedulePolicy, approvalTtlHours: 120 } }),
      );
      const late = new Date(Date.parse(FIXTURE_NEW_START) - 60 * 60_000);
      expect(code(approve(ledger, proposal.proposalId, late))).toBe('LEAD_TIME_VIOLATION');
    });
  });

  describe('repeated requests are safe', () => {
    it('returns the same result for a repeated approval and mints no second event', () => {
      const { ledger, proposal } = pendingFixture();
      const first = ok(approve(ledger, proposal.proposalId));
      const again = ok(approve(first.ledger, proposal.proposalId));

      expect(again.replayed).toBe(true);
      expect(again.ledger).toBe(first.ledger);
      expect(again.session.revision).toBe(2);
      expect(again.ledger.events.filter((event) => event.type === 'mentorship.session.rescheduled')).toHaveLength(1);
    });

    it('treats an approval after a decline as a conflict, not a second effect', () => {
      const { ledger, proposal } = pendingFixture();
      const declined = ok(
        decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW),
      );
      expect(code(approve(declined.ledger, proposal.proposalId))).toBe('PROPOSAL_NOT_PENDING');
    });

    it('returns the same result for a repeated decline', () => {
      const { ledger, proposal } = pendingFixture();
      const first = ok(
        decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW),
      );
      const again = ok(
        decideReschedule(first.ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW),
      );
      expect(again.replayed).toBe(true);
      expect(again.ledger.events).toHaveLength(first.ledger.events.length);
    });
  });

  it('closes a declined or withdrawn request with one event and no change to the session', () => {
    const { ledger, session, proposal } = pendingFixture();
    const declined = ok(
      decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW),
    );
    expect(declined.event).toMatchObject({ type: 'mentorship.session.reschedule_closed', outcome: 'declined' });
    expect(declined.ledger.sessions[0]).toEqual(session);

    const withdrawn = ok(
      decideReschedule(ledger, { actor: menteeActor, proposalId: proposal.proposalId, decision: 'withdraw', policy: decidePolicy }, FIXTURE_NOW),
    );
    expect(withdrawn.event).toMatchObject({ outcome: 'withdrawn' });
    expect(withdrawn.proposal.status).toBe('withdrawn');
  });

  it('gives two requests against one revision different event ids so neither is deduped away', () => {
    const { ledger, session, proposal } = pendingFixture();
    const declined = ok(
      decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'decline', policy: decidePolicy }, FIXTURE_NOW),
    );
    const next = ok(
      propose(declined.ledger, session.sessionId, {
        proposedStartsAt: '2026-11-05T15:00:00.000Z',
        idempotencyKey: 'resch-key-0002',
      }),
    );
    const ids = next.ledger.events.map((event) => event.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('applyReschedule', () => {
  const apply = (ledger: SessionLedger, sessionId: string, overrides: Partial<Parameters<typeof applyReschedule>[1]> = {}, now = FIXTURE_NOW) =>
    applyReschedule(
      ledger,
      {
        actor: coordinatorActor,
        sessionId,
        proposedStartsAt: FIXTURE_NEW_START,
        reason: 'The venue is closed that morning',
        idempotencyKey: 'apply-key-0001',
        policy: decidePolicy,
        ...overrides,
      },
      now,
    );

  it('lets a coordinator move a session directly, recorded as an override with no fee', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(apply(ledger, session.sessionId));

    expect(result.session).toMatchObject({ startsAt: FIXTURE_NEW_START, revision: 2, originalStartsAt: FIXTURE_SLOT_START });
    expect(result.session.timeChanges[0]).toMatchObject({ override: true, approvedBy: coordinatorActor.userId, reason: 'The venue is closed that morning' });
    expect(result.proposal).toMatchObject({ status: 'approved', feeMinor: 0 });
    expect(result.ledger.events.filter((event) => event.type === 'mentorship.session.rescheduled')).toHaveLength(1);
  });

  it('works inside the participant notice window because the coordinator owns the policy', () => {
    const { ledger, session } = bookedLedger();
    const nearStart = new Date(Date.parse(FIXTURE_SLOT_START) - 6 * HOUR);
    expect(apply(ledger, session.sessionId, { proposedStartsAt: '2026-11-04T10:00:00.000Z' }, nearStart).ok).toBe(true);
  });

  it.each([
    ['a mentee', menteeActor],
    ['a mentor', mentorActor],
    ['a coordinator from another tenant', { ...coordinatorActor, tenantId: 'tenant-b' }],
  ])('refuses %s', (_label, actor: SchedulingActor) => {
    const { ledger, session } = bookedLedger();
    expect(code(apply(ledger, session.sessionId, { actor }))).toBe('NOT_AUTHORIZED');
  });

  it('requires a reason and still enforces lead time and conflicts', () => {
    const { ledger, session } = bookedLedger();
    expect(code(apply(ledger, session.sessionId, { reason: '' }))).toBe('INVALID_SESSION');
    expect(code(apply(ledger, session.sessionId, { proposedStartsAt: '2026-11-02T10:00:00.000Z' }))).toBe('LEAD_TIME_VIOLATION');
  });

  it('is idempotent', () => {
    const { ledger, session } = bookedLedger();
    const first = ok(apply(ledger, session.sessionId));
    const again = ok(apply(first.ledger, session.sessionId));
    expect(again.replayed).toBe(true);
    expect(again.ledger).toBe(first.ledger);
    expect(again.session.revision).toBe(2);
    expect(code(apply(first.ledger, session.sessionId, { proposedStartsAt: '2026-11-09T10:00:00.000Z' }))).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

describe('reason visibility', () => {
  it('shows the reason to participants and coordinators of the tenant only', () => {
    const { proposal, session } = pendingFixture();
    expect(redactProposalFor(proposal, session, mentorActor)?.reason).toBe(REASON);
    expect(redactProposalFor(proposal, session, menteeActor)?.reason).toBe(REASON);
    expect(redactProposalFor(proposal, session, coordinatorActor)?.reason).toBe(REASON);
    expect(
      redactProposalFor(proposal, session, { userId: 'user-mentor-2', role: 'mentor', tenantId: 'tenant-a' })?.reason,
    ).toBe('');
    expect(redactProposalFor(proposal, session, { ...coordinatorActor, tenantId: 'tenant-b' })).toBeNull();
  });
});

describe('calendar convergence', () => {
  const entry = (revision: number, startsAt: string): CalendarEntry => ({
    sessionId: 'ses-1',
    revision,
    startsAt,
    endsAt: startsAt,
    status: 'booked',
  });
  const updates = [entry(1, 'a'), entry(2, 'b'), entry(3, 'c'), entry(2, 'b')];

  const permutations = <T,>(items: readonly T[]): T[][] =>
    items.length <= 1
      ? [[...items]]
      : items.flatMap((item, index) =>
          permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
        );

  it('reaches the same final state for every delivery order, including duplicates', () => {
    const results = permutations(updates).map((order) =>
      order.reduce<CalendarEntry[]>((entries, update) => applyCalendarUpdate(entries, update), []),
    );
    expect(results.length).toBeGreaterThan(10);
    for (const result of results) {
      expect(result).toEqual([entry(3, 'c')]);
    }
  });

  it('ignores a stale update and an exact repeat', () => {
    const current = [entry(3, 'c')];
    expect(applyCalendarUpdate(current, entry(2, 'b'))).toEqual(current);
    expect(applyCalendarUpdate(current, entry(3, 'c'))).toEqual(current);
  });

  it('keeps independent sessions side by side in a stable order', () => {
    const other: CalendarEntry = { ...entry(1, 'z'), sessionId: 'ses-0' };
    const merged = applyCalendarUpdate(applyCalendarUpdate([], entry(1, 'a')), other);
    expect(merged.map((item) => item.sessionId)).toEqual(['ses-0', 'ses-1']);
  });

  it('follows a real reschedule: the calendar ends on the approved time', () => {
    const { ledger, proposal } = pendingFixture();
    const before = ledger.sessions[0];
    const approved = ok(
      decideReschedule(ledger, { actor: mentorActor, proposalId: proposal.proposalId, decision: 'approve', policy: decidePolicy }, FIXTURE_NOW),
    );
    const calendar = [approved.session, before].reduce<CalendarEntry[]>(
      (entries, session) => applyCalendarUpdate(entries, calendarEntryOf(session)),
      [],
    );
    expect(calendar).toEqual([calendarEntryOf(approved.session)]);
    expect(calendar[0].startsAt).toBe(FIXTURE_NEW_START);
  });
});
