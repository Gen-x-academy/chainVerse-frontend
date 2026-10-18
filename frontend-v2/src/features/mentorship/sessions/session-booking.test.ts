import { describe, expect, it } from 'vitest';
import {
  AGENDA_MAX_LENGTH,
  bookSession,
  buildBookingConfirmation,
  type BookSessionResult,
} from './session-booking';
import {
  SCHEDULING_ERRORS,
  createSessionLedger,
  describeSchedulingFailure,
  toSchedulingRole,
  type SessionLedger,
} from './session-core';
import {
  FIXTURE_NOW,
  FIXTURE_SLOT_END,
  FIXTURE_SLOT_START,
  MENTEE_ID,
  MENTOR_ID,
  activeAgreement,
  bookingInput,
  coordinatorActor,
  menteeActor,
  mentorActor,
} from './test-fixtures';
import { canAccessMentorshipArea } from '../rbac';

function expectOk(result: BookSessionResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

function expectError(result: BookSessionResult) {
  if (result.ok) throw new Error('expected an error');
  return result.error;
}

const empty = (): SessionLedger => createSessionLedger();

describe('bookSession', () => {
  it('books a session from an active agreement', () => {
    const result = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));

    expect(result.replayed).toBe(false);
    expect(result.session).toMatchObject({
      agreementId: 'agr-1',
      engagementId: 'eng-1',
      mentorId: MENTOR_ID,
      menteeId: MENTEE_ID,
      startsAt: FIXTURE_SLOT_START,
      endsAt: FIXTURE_SLOT_END,
      durationMinutes: 30,
      mode: 'virtual',
      status: 'booked',
      revision: 1,
      bookedBy: MENTEE_ID,
    });
    expect(result.ledger.sessions).toHaveLength(1);
  });

  it('is deterministic: the same input yields the same session and event ids', () => {
    const a = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
    const b = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
    expect(a.session.sessionId).toBe(b.session.sessionId);
    expect(a.event?.eventId).toBe(b.event?.eventId);
  });

  it('emits exactly one canonical event carrying no free text', () => {
    const result = expectOk(
      bookSession(
        empty(),
        bookingInput({ mode: 'in_person', locationRef: 'loc_main-hall', agenda: 'Review my portfolio' }),
        FIXTURE_NOW,
      ),
    );

    expect(result.ledger.events).toHaveLength(1);
    expect(result.event).toMatchObject({
      type: 'mentorship.session.booked',
      sessionId: result.session.sessionId,
      revision: 1,
      actorId: MENTEE_ID,
    });
    const serialised = JSON.stringify(result.event);
    expect(serialised).not.toContain('Review my portfolio');
    expect(serialised).not.toContain('loc_main-hall');
    expect(Object.keys(result.event ?? {})).not.toContain('agenda');
  });

  it('lets a coordinator book on behalf of the participants', () => {
    const result = bookSession(empty(), bookingInput({ actor: coordinatorActor }), FIXTURE_NOW);
    expect(result.ok).toBe(true);
  });

  describe('authorization is deny by default', () => {
    it.each([
      ['an unrelated mentor', { userId: 'user-mentor-2', role: 'mentor' as const, tenantId: 'tenant-a' }],
      ['the wrong mentee', { userId: 'user-mentee-2', role: 'mentee' as const, tenantId: 'tenant-a' }],
      ['a participant from another tenant', { ...menteeActor, tenantId: 'tenant-b' }],
      ['a coordinator from another tenant', { ...coordinatorActor, tenantId: 'tenant-b' }],
      ['a mentee id presented with the mentor role', { userId: MENTEE_ID, role: 'mentor' as const, tenantId: 'tenant-a' }],
    ])('refuses %s without changing the ledger', (_label, actor) => {
      const ledger = empty();
      const error = expectError(bookSession(ledger, bookingInput({ actor }), FIXTURE_NOW));
      expect(error.code).toBe('NOT_AUTHORIZED');
      expect(error.status).toBe(403);
      expect(error.issues).toBeUndefined();
      expect(ledger.sessions).toHaveLength(0);
    });

    it('reports authorization before agreement state so nothing about it leaks', () => {
      const error = expectError(
        bookSession(
          empty(),
          bookingInput({
            actor: { ...menteeActor, tenantId: 'tenant-b' },
            agreement: { ...activeAgreement, status: 'draft' },
          }),
          FIXTURE_NOW,
        ),
      );
      expect(error.code).toBe('NOT_AUTHORIZED');
    });
  });

  it.each(['draft', 'pending_acceptance', 'superseded'] as const)(
    'requires an active agreement (%s is refused)',
    (status) => {
      const error = expectError(
        bookSession(empty(), bookingInput({ agreement: { ...activeAgreement, status } }), FIXTURE_NOW),
      );
      expect(error.code).toBe('AGREEMENT_NOT_ACTIVE');
      expect(error.status).toBe(409);
    },
  );

  describe('validation', () => {
    it('rejects participants that are not the agreement parties', () => {
      const error = expectError(
        bookSession(
          empty(),
          bookingInput({ participants: { mentorId: MENTOR_ID, menteeId: 'someone-else' } }),
          FIXTURE_NOW,
        ),
      );
      expect(error.code).toBe('INVALID_SESSION');
      expect(error.issues?.map((issue) => issue.field)).toContain('participants');
    });

    it('collects every field problem in one response', () => {
      const error = expectError(
        bookSession(
          empty(),
          bookingInput({
            startsAt: 'not-a-date',
            durationMinutes: 50,
            mode: 'in_person',
            agenda: '<script>alert(1)</script>',
          }),
          FIXTURE_NOW,
        ),
      );
      expect(error.code).toBe('INVALID_SESSION');
      expect(error.issues?.map((issue) => issue.field).sort()).toEqual(
        ['agenda', 'durationMinutes', 'locationRef', 'startsAt'].sort(),
      );
    });

    it('requires a location reference for in-person and hybrid sessions only', () => {
      expect(bookSession(empty(), bookingInput({ mode: 'virtual' }), FIXTURE_NOW).ok).toBe(true);
      for (const mode of ['in_person', 'hybrid'] as const) {
        const error = expectError(bookSession(empty(), bookingInput({ mode }), FIXTURE_NOW));
        expect(error.issues?.[0].field).toBe('locationRef');
      }
      expect(
        bookSession(empty(), bookingInput({ mode: 'hybrid', locationRef: 'loc-12' }), FIXTURE_NOW).ok,
      ).toBe(true);
    });

    it('rejects a location reference that looks like free text', () => {
      const error = expectError(
        bookSession(empty(), bookingInput({ mode: 'in_person', locationRef: '12 Main Street, Lagos' }), FIXTURE_NOW),
      );
      expect(error.issues?.[0]).toMatchObject({ field: 'locationRef' });
    });

    it('enforces the agenda length and plain text rule', () => {
      const tooLong = expectError(
        bookSession(empty(), bookingInput({ agenda: 'a'.repeat(AGENDA_MAX_LENGTH + 1) }), FIXTURE_NOW),
      );
      expect(tooLong.issues?.[0].field).toBe('agenda');
      expect(
        bookSession(empty(), bookingInput({ agenda: 'a'.repeat(AGENDA_MAX_LENGTH) }), FIXTURE_NOW).ok,
      ).toBe(true);
    });

    it('rejects an unrecognised time zone', () => {
      const error = expectError(bookSession(empty(), bookingInput({ timeZone: 'Mars/Olympus' }), FIXTURE_NOW));
      expect(error.code).toBe('INVALID_TIME_ZONE');
    });
  });

  describe('lead time', () => {
    it('refuses a start inside the lead time window', () => {
      const error = expectError(
        bookSession(empty(), bookingInput({ startsAt: '2026-11-02T10:59:00.000Z' }), FIXTURE_NOW),
      );
      expect(error.code).toBe('LEAD_TIME_VIOLATION');
    });

    it('accepts a start exactly at the lead time boundary', () => {
      const result = bookSession(empty(), bookingInput({ startsAt: '2026-11-02T11:00:00.000Z' }), FIXTURE_NOW);
      expect(result.ok).toBe(true);
    });

    it('refuses a start in the past', () => {
      const error = expectError(
        bookSession(empty(), bookingInput({ startsAt: '2026-11-01T09:00:00.000Z' }), FIXTURE_NOW),
      );
      expect(error.code).toBe('LEAD_TIME_VIOLATION');
    });
  });

  describe('double booking protection', () => {
    it('refuses an overlapping session for the same participants', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const error = expectError(
        bookSession(
          first.ledger,
          bookingInput({ idempotencyKey: 'book-key-0002', startsAt: '2026-11-03T14:15:00.000Z' }),
          FIXTURE_NOW,
        ),
      );
      expect(error.code).toBe('SLOT_CONFLICT');
      expect(first.ledger.sessions).toHaveLength(1);
    });

    it('allows a session that starts exactly when the previous one ends', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const next = bookSession(
        first.ledger,
        bookingInput({ idempotencyKey: 'book-key-0002', startsAt: FIXTURE_SLOT_END }),
        FIXTURE_NOW,
      );
      expect(next.ok).toBe(true);
    });

    it('honours the buffer around existing sessions', () => {
      const policy = { leadTimeMinutes: 120, allowedDurationsMinutes: [30], bufferMinutes: 15 };
      const first = expectOk(bookSession(empty(), bookingInput({ policy }), FIXTURE_NOW));
      const tooClose = bookSession(
        first.ledger,
        bookingInput({ policy, idempotencyKey: 'book-key-0002', startsAt: FIXTURE_SLOT_END }),
        FIXTURE_NOW,
      );
      expect(expectError(tooClose).code).toBe('SLOT_CONFLICT');
      const clear = bookSession(
        first.ledger,
        bookingInput({ policy, idempotencyKey: 'book-key-0003', startsAt: '2026-11-03T14:45:00.000Z' }),
        FIXTURE_NOW,
      );
      expect(clear.ok).toBe(true);
    });

    it('ignores cancelled sessions so the slot becomes reusable', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const cancelled = createSessionLedger({
        ...first.ledger,
        sessions: first.ledger.sessions.map((session) => ({ ...session, status: 'cancelled' as const })),
      });
      const result = bookSession(cancelled, bookingInput({ idempotencyKey: 'book-key-0002' }), FIXTURE_NOW);
      expect(result.ok).toBe(true);
    });

    it('blocks the same mentor across different mentees', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const otherAgreement = {
        ...activeAgreement,
        agreementId: 'agr-2',
        engagementId: 'eng-2',
        menteeId: 'user-mentee-2',
      };
      const error = expectError(
        bookSession(
          first.ledger,
          bookingInput({
            actor: { userId: 'user-mentee-2', role: 'mentee', tenantId: 'tenant-a' },
            agreement: otherAgreement,
            participants: { mentorId: MENTOR_ID, menteeId: 'user-mentee-2' },
            idempotencyKey: 'book-key-9999',
          }),
          FIXTURE_NOW,
        ),
      );
      expect(error.code).toBe('SLOT_CONFLICT');
    });

    it('lets exactly one of many racing requests win', () => {
      let ledger = empty();
      const outcomes = Array.from({ length: 25 }, (_, index) => {
        const result = bookSession(ledger, bookingInput({ idempotencyKey: `book-key-race-${index}` }), FIXTURE_NOW);
        if (result.ok) ledger = result.ledger;
        return result;
      });
      expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
      expect(outcomes.filter((result) => !result.ok && result.error.code === 'SLOT_CONFLICT')).toHaveLength(24);
      expect(ledger.sessions).toHaveLength(1);
      expect(ledger.events).toHaveLength(1);
    });

    it('refuses the second of two requests computed from the same stale ledger once applied', () => {
      const base = empty();
      const mentorRequest = bookSession(base, bookingInput({ actor: mentorActor, idempotencyKey: 'book-key-m-1' }), FIXTURE_NOW);
      const menteeRequest = bookSession(base, bookingInput({ idempotencyKey: 'book-key-e-1' }), FIXTURE_NOW);
      expect(mentorRequest.ok && menteeRequest.ok).toBe(true);

      // The ledger serialises them: whichever commits second is re-evaluated.
      const committed = expectOk(mentorRequest).ledger;
      const retry = bookSession(committed, bookingInput({ idempotencyKey: 'book-key-e-1' }), FIXTURE_NOW);
      expect(expectError(retry).code).toBe('SLOT_CONFLICT');
    });
  });

  describe('idempotency', () => {
    it('returns the original booking for a repeated request and mints no new event', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const again = expectOk(bookSession(first.ledger, bookingInput(), FIXTURE_NOW));

      expect(again.replayed).toBe(true);
      expect(again.session).toEqual(first.session);
      expect(again.event).toBeUndefined();
      expect(again.ledger).toBe(first.ledger);
      expect(again.ledger.events).toHaveLength(1);
    });

    it('still honours a replay after the lead time window has closed', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const later = new Date('2026-11-03T13:00:00.000Z');
      const again = expectOk(bookSession(first.ledger, bookingInput(), later));
      expect(again.replayed).toBe(true);
    });

    it('treats a different display time zone as the same request', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const again = expectOk(bookSession(first.ledger, bookingInput({ timeZone: 'Europe/Berlin' }), FIXTURE_NOW));
      expect(again.replayed).toBe(true);
    });

    it('rejects a key reused for different details', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const error = expectError(
        bookSession(first.ledger, bookingInput({ startsAt: '2026-11-03T16:00:00.000Z' }), FIXTURE_NOW),
      );
      expect(error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('scopes keys to the actor so one participant cannot replay the other', () => {
      const first = expectOk(bookSession(empty(), bookingInput(), FIXTURE_NOW));
      const mentorSame = bookSession(first.ledger, bookingInput({ actor: mentorActor }), FIXTURE_NOW);
      // A different actor with the same key is a new intent, so it hits the conflict, not a replay.
      expect(expectError(mentorSame).code).toBe('SLOT_CONFLICT');
    });

    it.each(['', 'short', 'has spaces in it', 'x'.repeat(129)])('rejects the malformed key %j', (key) => {
      const error = expectError(bookSession(empty(), bookingInput({ idempotencyKey: key }), FIXTURE_NOW));
      expect(error.code).toBe('IDEMPOTENCY_KEY_INVALID');
    });
  });
});

describe('buildBookingConfirmation', () => {
  it('shows the viewer local time and UTC for the same instant', () => {
    const confirmation = buildBookingConfirmation(
      {
        sessionId: 'ses-1',
        startsAt: FIXTURE_SLOT_START,
        endsAt: FIXTURE_SLOT_END,
        mode: 'virtual',
        durationMinutes: 30,
      },
      'America/New_York',
    );
    expect(confirmation.time.local).toContain('9:00 AM to 9:30 AM');
    expect(confirmation.time.local).toContain('EST');
    expect(confirmation.time.utc).toContain('14:00 to 14:30');
    expect(confirmation.time.utc).toContain('UTC');
    expect(confirmation.time.startsAtUtc).toBe(FIXTURE_SLOT_START);
    expect(confirmation.replayed).toBe(false);
  });

  it('keeps the UTC instant fixed while the local rendering follows the zone', () => {
    const berlin = buildBookingConfirmation(
      { sessionId: 'ses-1', startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END, mode: 'virtual', durationMinutes: 30 },
      'Europe/Berlin',
    );
    expect(berlin.time.local).toContain('3:00 PM to 3:30 PM');
    expect(berlin.time.utc).toContain('14:00 to 14:30');
  });

  it('falls back to UTC for an unrecognised zone instead of throwing', () => {
    const fallback = buildBookingConfirmation(
      { sessionId: 'ses-1', startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END, mode: 'virtual', durationMinutes: 30 },
      'Nope/Nowhere',
    );
    expect(fallback.time.timeZone).toBe('UTC');
  });
});

describe('scheduling errors', () => {
  it('keeps stable codes, statuses and messages', () => {
    const table = Object.entries(SCHEDULING_ERRORS).map(([code, definition]) => [code, definition.status]);
    expect(table).toEqual([
      ['NOT_AUTHORIZED', 403],
      ['AGREEMENT_NOT_ACTIVE', 409],
      ['INVALID_SESSION', 422],
      ['INVALID_TIME_ZONE', 422],
      ['LEAD_TIME_VIOLATION', 422],
      ['SLOT_CONFLICT', 409],
      ['IDEMPOTENCY_KEY_INVALID', 400],
      ['IDEMPOTENCY_KEY_REUSED', 422],
      ['SESSION_NOT_BOOKED', 409],
      ['RESCHEDULE_NOTICE_VIOLATION', 422],
      ['PAYMENT_PREVIEW_MISMATCH', 409],
      ['PROPOSAL_NOT_PENDING', 409],
      ['PROPOSAL_STALE', 409],
      ['PROPOSAL_EXPIRED', 410],
      ['APPROVAL_NOT_ALLOWED', 403],
      ['UNKNOWN', 500],
    ]);
  });

  it('gives every message a next step and keeps personal data out', () => {
    for (const definition of Object.values(SCHEDULING_ERRORS)) {
      expect(definition.message.length).toBeGreaterThan(20);
      expect(definition.message).not.toMatch(/@|user-|tenant-/);
    }
  });

  it('maps API failures to stable errors', () => {
    expect(describeSchedulingFailure({ code: 'SLOT_CONFLICT' }).code).toBe('SLOT_CONFLICT');
    expect(describeSchedulingFailure(new Error(JSON.stringify({ code: 'LEAD_TIME_VIOLATION' }))).code).toBe(
      'LEAD_TIME_VIOLATION',
    );
    const unknown = describeSchedulingFailure(new Error('socket hang up'));
    expect(unknown.code).toBe('UNKNOWN');
    expect(unknown.retryable).toBe(true);
    expect(describeSchedulingFailure({ code: 'MADE_UP' }).code).toBe('UNKNOWN');
    expect(describeSchedulingFailure(null).code).toBe('UNKNOWN');
  });
});

describe('role-aware access', () => {
  it('maps only scheduling roles and denies the rest', () => {
    expect(toSchedulingRole('mentor')).toBe('mentor');
    expect(toSchedulingRole('student')).toBe('mentee');
    expect(toSchedulingRole('organization-staff')).toBe('coordinator');
    expect(toSchedulingRole('administrator')).toBe('administrator');
    for (const role of ['guardian', 'finance', 'moderator', 'tutor'] as const) {
      expect(toSchedulingRole(role)).toBeUndefined();
    }
    expect(toSchedulingRole(undefined)).toBeUndefined();
  });

  it('exposes the sessions area to scheduling roles only', () => {
    for (const role of ['student', 'mentor', 'organization-staff', 'administrator']) {
      expect(canAccessMentorshipArea(role, 'sessions')).toBe(true);
    }
    for (const role of ['guardian', 'finance', 'moderator', 'tutor', 'stranger', undefined]) {
      expect(canAccessMentorshipArea(role, 'sessions')).toBe(false);
    }
  });
});
