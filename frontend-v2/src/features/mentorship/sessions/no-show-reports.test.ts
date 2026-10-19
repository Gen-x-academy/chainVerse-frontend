import { describe, expect, it } from 'vitest';
import {
  applyDueConsequences,
  createNoShowReport,
  dueProcessSatisfied,
  normalizeEvidence,
  redactNoShowReportFor,
  resolveNoShowReport,
  respondToNoShowReport,
  type CreateNoShowReportInput,
  type NoShowResult,
} from './no-show-reports';
import { createSessionLedger, type NoShowOutcome, type SchedulingActor, type SessionLedger } from './session-core';
import {
  MENTEE_ID,
  MENTOR_ID,
  NO_SHOW_NOW,
  bookedLedger,
  coordinatorActor,
  menteeActor,
  mentorActor,
  noShowPolicy,
} from './test-fixtures';

const HOUR = 3_600_000;
const ATTACHMENT = { kind: 'attachment', attachmentRef: 'att-0001-abcd', mimeType: 'image/png', sizeBytes: 1024 } as const;
const STATEMENT = 'The mentor never joined the call';

function ok(result: NoShowResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

function code(result: NoShowResult) {
  if (result.ok) throw new Error('expected an error');
  return result.error.code;
}

function report(
  ledger: SessionLedger,
  sessionId: string,
  overrides: Partial<CreateNoShowReportInput> = {},
  now: Date = NO_SHOW_NOW,
) {
  return createNoShowReport(
    ledger,
    {
      actor: menteeActor,
      sessionId,
      type: 'mentor',
      statement: STATEMENT,
      evidence: [],
      idempotencyKey: 'noshow-key-0001',
      policy: noShowPolicy,
      ...overrides,
    },
    now,
  );
}

const mentorReports = (ledger: SessionLedger, sessionId: string, overrides: Partial<CreateNoShowReportInput> = {}, now = NO_SHOW_NOW) =>
  report(ledger, sessionId, { actor: mentorActor, type: 'mentee', statement: 'The mentee never joined', idempotencyKey: 'noshow-key-mentor', ...overrides }, now);

function opened(overrides: Partial<CreateNoShowReportInput> = {}) {
  const { ledger, session } = bookedLedger();
  const created = ok(report(ledger, session.sessionId, overrides));
  return { ledger: created.ledger, session, report: created.report };
}

const respond = (ledger: SessionLedger, reportId: string, actor: SchedulingActor = mentorActor, overrides = {}, now = NO_SHOW_NOW) =>
  respondToNoShowReport(ledger, { actor, reportId, statement: 'I was waiting in the room the whole time', evidence: [], policy: noShowPolicy, ...overrides }, now);

const resolveAs = (ledger: SessionLedger, reportId: string, outcome: NoShowOutcome, now = NO_SHOW_NOW, actor: SchedulingActor = coordinatorActor) =>
  resolveNoShowReport(ledger, { actor, reportId, outcome, note: 'Reviewed the call logs' }, now);

describe('createNoShowReport', () => {
  it('opens a report with the claim, a response deadline and consequences held back', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(report(ledger, session.sessionId, { evidence: [{ kind: 'note', text: 'Waited 15 minutes' }, ATTACHMENT] }));

    expect(result.merged).toBe(false);
    expect(result.report).toMatchObject({
      sessionId: session.sessionId,
      status: 'open',
      conflicting: false,
      consequence: 'pending_policy',
      createdAt: NO_SHOW_NOW.toISOString(),
      responseDeadline: new Date(NO_SHOW_NOW.getTime() + 48 * HOUR).toISOString(),
    });
    expect(result.report.claims).toHaveLength(1);
    expect(result.report.claims[0]).toMatchObject({
      reporterId: MENTEE_ID,
      reporterRole: 'mentee',
      type: 'mentor',
      statement: STATEMENT,
    });
    expect(result.report.claims[0].evidence).toHaveLength(2);
  });

  it('never changes the session or sends anything to settlement', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(report(ledger, session.sessionId));
    expect(result.ledger.sessions[0]).toEqual(session);
    expect(result.ledger.settlements).toHaveLength(0);
  });

  it('emits one canonical event with the type and no statement or evidence', () => {
    const { ledger, session } = bookedLedger();
    const result = ok(report(ledger, session.sessionId, { evidence: [{ kind: 'note', text: 'Waited 15 minutes' }] }));
    const events = result.ledger.events.filter((event) => event.type === 'mentorship.session.no_show_reported');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ noShowType: 'mentor', reportId: result.report.reportId, actorId: MENTEE_ID });
    expect(JSON.stringify(events[0])).not.toContain('never joined');
    expect(JSON.stringify(events[0])).not.toContain('Waited');
  });

  describe('requires a booked session and a permitted reporter', () => {
    it('refuses a cancelled session but accepts a completed one', () => {
      const { ledger, session } = bookedLedger();
      const cancelled = createSessionLedger({ ...ledger, sessions: [{ ...session, status: 'cancelled' }] });
      expect(code(report(cancelled, session.sessionId))).toBe('SESSION_NOT_BOOKED');
      const completed = createSessionLedger({ ...ledger, sessions: [{ ...session, status: 'completed' }] });
      expect(report(completed, session.sessionId).ok).toBe(true);
    });

    it.each([
      ['an unrelated mentor', { userId: 'user-mentor-2', role: 'mentor' as const, tenantId: 'tenant-a' }],
      ['the wrong mentee', { userId: 'user-mentee-2', role: 'mentee' as const, tenantId: 'tenant-a' }],
      ['a participant from another tenant', { ...menteeActor, tenantId: 'tenant-b' }],
      ['a coordinator, who resolves rather than reports', coordinatorActor],
    ])('refuses %s', (_label, actor: SchedulingActor) => {
      const { ledger, session } = bookedLedger();
      expect(code(report(ledger, session.sessionId, { actor }))).toBe('NOT_AUTHORIZED');
    });

    it('answers an unknown session exactly like a forbidden one', () => {
      expect(code(report(bookedLedger().ledger, 'ses-nope'))).toBe('NOT_AUTHORIZED');
    });

    it('only offers each participant the types that make sense for them', () => {
      const { ledger, session } = bookedLedger();
      expect(code(report(ledger, session.sessionId, { type: 'mentee' }))).toBe('INVALID_SESSION');
      expect(code(mentorReports(ledger, session.sessionId, { type: 'mentor' }))).toBe('INVALID_SESSION');
      for (const type of ['both', 'technical'] as const) {
        expect(report(ledger, session.sessionId, { type }).ok).toBe(true);
      }
    });
  });

  describe('reporting window', () => {
    const at = (offsetMinutes: number) => new Date(Date.parse('2026-11-03T14:00:00.000Z') + offsetMinutes * 60_000);

    it('waits for the grace period, boundary included', () => {
      const { ledger, session } = bookedLedger();
      expect(code(report(ledger, session.sessionId, {}, at(9.9)))).toBe('NO_SHOW_TOO_EARLY');
      expect(report(ledger, session.sessionId, {}, at(10)).ok).toBe(true);
    });

    it('closes after the configured window, boundary included', () => {
      const { ledger, session } = bookedLedger();
      const end = Date.parse('2026-11-03T14:30:00.000Z');
      expect(report(ledger, session.sessionId, {}, new Date(end + 24 * HOUR)).ok).toBe(true);
      expect(code(report(ledger, session.sessionId, {}, new Date(end + 24 * HOUR + 1)))).toBe('NO_SHOW_WINDOW_CLOSED');
    });
  });

  describe('validation and limited evidence', () => {
    it('needs a plain statement of a sensible length', () => {
      const { ledger, session } = bookedLedger();
      for (const statement of ['no', '<b>x</b> they never came', 'x'.repeat(1001)]) {
        expect(code(report(ledger, session.sessionId, { statement }))).toBe('INVALID_SESSION');
      }
    });

    it('limits the number of items', () => {
      const { ledger, session } = bookedLedger();
      const four = Array.from({ length: 4 }, (_, index) => ({ kind: 'note', text: `note ${index}` }));
      expect(code(report(ledger, session.sessionId, { evidence: four }))).toBe('INVALID_SESSION');
      expect(report(ledger, session.sessionId, { evidence: four.slice(0, 3) }).ok).toBe(true);
    });

    it.each([
      ['an empty note', { kind: 'note', text: '   ' }],
      ['a long note', { kind: 'note', text: 'x'.repeat(501) }],
      ['a note with markup', { kind: 'note', text: '<img src=x onerror=1>' }],
      ['an attachment with a bad reference', { ...ATTACHMENT, attachmentRef: '../etc/passwd' }],
      ['an attachment of a disallowed type', { ...ATTACHMENT, mimeType: 'application/x-msdownload' }],
      ['an attachment that is too large', { ...ATTACHMENT, sizeBytes: 5 * 1024 * 1024 + 1 }],
      ['an empty attachment', { ...ATTACHMENT, sizeBytes: 0 }],
      ['an unknown kind', { kind: 'video', url: 'https://example.com' }],
    ])('rejects %s', (_label, item) => {
      const { ledger, session } = bookedLedger();
      expect(code(report(ledger, session.sessionId, { evidence: [item] }))).toBe('INVALID_SESSION');
    });

    it('keeps only the known fields of accepted evidence', () => {
      const { evidence } = normalizeEvidence(
        [{ ...ATTACHMENT, url: 'https://evil.example', extra: 1 }, { kind: 'note', text: '  hello  ', html: '<b>' }],
        noShowPolicy,
      );
      expect(evidence).toEqual([ATTACHMENT, { kind: 'note', text: 'hello' }]);
    });
  });

  describe('idempotency and duplicates', () => {
    it('returns the same report for a repeat with the same key and mints no second event', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(report(ledger, session.sessionId));
      const again = ok(report(first.ledger, session.sessionId));
      expect(again.replayed).toBe(true);
      expect(again.report).toEqual(first.report);
      expect(again.event).toBeUndefined();
      expect(again.ledger).toBe(first.ledger);
    });

    it('treats a repeat with a new key as the same claim', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(report(ledger, session.sessionId));
      const again = ok(report(first.ledger, session.sessionId, { idempotencyKey: 'noshow-key-0002' }));
      expect(again.replayed).toBe(true);
      expect(again.ledger.noShowReports[0].claims).toHaveLength(1);
      expect(again.ledger.events.filter((event) => event.type === 'mentorship.session.no_show_reported')).toHaveLength(1);
    });

    it('rejects a key reused for different details and a changed claim by the same person', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(report(ledger, session.sessionId));
      expect(code(report(first.ledger, session.sessionId, { type: 'both' }))).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(code(report(first.ledger, session.sessionId, { type: 'both', idempotencyKey: 'noshow-key-0002' }))).toBe(
        'NO_SHOW_ALREADY_REPORTED',
      );
    });

    it.each(['', 'short', 'has spaces in it'])('rejects the malformed key %j', (key) => {
      const { ledger, session } = bookedLedger();
      expect(code(report(ledger, session.sessionId, { idempotencyKey: key }))).toBe('IDEMPOTENCY_KEY_INVALID');
    });

    it('merges the other participant into the same report and keeps the deadline', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(report(ledger, session.sessionId, { type: 'both' }));
      const later = new Date(NO_SHOW_NOW.getTime() + 2 * HOUR);
      const second = ok(mentorReports(first.ledger, session.sessionId, { type: 'both' }, later));

      expect(second.merged).toBe(true);
      expect(second.ledger.noShowReports).toHaveLength(1);
      expect(second.report.claims).toHaveLength(2);
      expect(second.report.conflicting).toBe(false);
      expect(second.report.responseDeadline).toBe(first.report.responseDeadline);
      expect(second.report.reportId).toBe(first.report.reportId);
      const ids = second.ledger.events.map((event) => event.eventId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('flags opposite claims as conflicting so only a coordinator can settle them', () => {
      const { ledger, session } = bookedLedger();
      const first = ok(report(ledger, session.sessionId));
      const second = ok(mentorReports(first.ledger, session.sessionId));
      expect(second.report.conflicting).toBe(true);
    });

    it('reaches the same report whichever participant reports first', () => {
      const { ledger, session } = bookedLedger();
      const ab = ok(mentorReports(ok(report(ledger, session.sessionId)).ledger, session.sessionId)).report;
      const ba = ok(report(ok(mentorReports(ledger, session.sessionId)).ledger, session.sessionId)).report;

      expect(ab.reportId).toBe(ba.reportId);
      expect(ab.conflicting).toBe(ba.conflicting);
      expect([...ab.claims].map((claim) => claim.claimId).sort()).toEqual([...ba.claims].map((claim) => claim.claimId).sort());
    });

    it('refuses a new claim once the report is resolved', () => {
      const { ledger, session, report: opened1 } = opened();
      const resolved = ok(resolveAs(ledger, opened1.reportId, 'dismiss'));
      expect(code(mentorReports(resolved.ledger, session.sessionId))).toBe('NO_SHOW_ALREADY_RESOLVED');
    });
  });
});

describe('respondToNoShowReport', () => {
  it('records the accused response and keeps the report open', () => {
    const { ledger, report: r } = opened();
    const result = ok(respond(ledger, r.reportId, mentorActor, { evidence: [{ kind: 'note', text: 'Logged in at 14:00' }] }));

    expect(result.report.status).toBe('open');
    expect(result.report.responses).toEqual([
      {
        responderId: MENTOR_ID,
        statement: 'I was waiting in the room the whole time',
        evidence: [{ kind: 'note', text: 'Logged in at 14:00' }],
        respondedAt: NO_SHOW_NOW.toISOString(),
      },
    ]);
    expect(result.event).toMatchObject({ type: 'mentorship.session.no_show_responded', actorId: MENTOR_ID });
    expect(JSON.stringify(result.event)).not.toContain('waiting');
  });

  it('refuses the claimant, outsiders and unknown reports', () => {
    const { ledger, report: r } = opened();
    expect(code(respond(ledger, r.reportId, menteeActor))).toBe('NO_SHOW_ALREADY_REPORTED');
    expect(code(respond(ledger, r.reportId, { userId: 'user-mentor-2', role: 'mentor', tenantId: 'tenant-a' }))).toBe('NOT_AUTHORIZED');
    expect(code(respond(ledger, r.reportId, coordinatorActor))).toBe('NOT_AUTHORIZED');
    expect(code(respond(ledger, 'nsr-nope'))).toBe('NOT_AUTHORIZED');
  });

  it('treats an identical repeat as a replay and refuses a different second answer', () => {
    const { ledger, report: r } = opened();
    const first = ok(respond(ledger, r.reportId));
    const again = ok(respond(first.ledger, r.reportId));
    expect(again.replayed).toBe(true);
    expect(again.ledger).toBe(first.ledger);
    expect(code(respond(first.ledger, r.reportId, mentorActor, { statement: 'Actually I forgot the time' }))).toBe('NO_SHOW_ALREADY_RESPONDED');
  });

  it('still hears the accused after the deadline, until the report is resolved', () => {
    const { ledger, report: r } = opened();
    const late = new Date(Date.parse(r.responseDeadline) + HOUR);
    expect(respond(ledger, r.reportId, mentorActor, {}, late).ok).toBe(true);

    const resolved = ok(resolveAs(ledger, r.reportId, 'dismiss'));
    expect(code(respond(resolved.ledger, r.reportId))).toBe('NO_SHOW_ALREADY_RESOLVED');
  });

  it('validates the statement and the limited evidence', () => {
    const { ledger, report: r } = opened();
    expect(code(respond(ledger, r.reportId, mentorActor, { statement: 'no' }))).toBe('INVALID_SESSION');
    expect(code(respond(ledger, r.reportId, mentorActor, { evidence: [{ kind: 'note', text: '<b>' }] }))).toBe('INVALID_SESSION');
  });
});

describe('due process and resolution', () => {
  it('will not rule against the accused before they have responded or the deadline passes', () => {
    const { ledger, report: r } = opened();
    expect(code(resolveAs(ledger, r.reportId, 'uphold_mentor_no_show'))).toBe('DUE_PROCESS_PENDING');
    expect(code(resolveAs(ledger, r.reportId, 'uphold_both_absent'))).toBe('DUE_PROCESS_PENDING');
  });

  it('allows a ruling once the accused has responded', () => {
    const { ledger, report: r } = opened();
    const answered = ok(respond(ledger, r.reportId));
    expect(resolveAs(answered.ledger, r.reportId, 'uphold_mentor_no_show').ok).toBe(true);
  });

  it('allows a ruling once the deadline has passed, the instant included', () => {
    const { ledger, report: r } = opened();
    const deadline = Date.parse(r.responseDeadline);
    expect(code(resolveAs(ledger, r.reportId, 'uphold_mentor_no_show', new Date(deadline - 1)))).toBe('DUE_PROCESS_PENDING');
    expect(resolveAs(ledger, r.reportId, 'uphold_mentor_no_show', new Date(deadline)).ok).toBe(true);
  });

  it('lets outcomes that harm nobody through at any time', () => {
    const { ledger, report: r } = opened();
    expect(resolveAs(ledger, r.reportId, 'dismiss').ok).toBe(true);
    expect(resolveAs(ledger, r.reportId, 'technical_issue').ok).toBe(true);
  });

  it('treats claimants as heard, so a conflicting report can be ruled on at once', () => {
    const { ledger, session, report: r } = opened();
    const conflict = ok(mentorReports(ledger, session.sessionId));
    expect(dueProcessSatisfied(conflict.report, session, NO_SHOW_NOW)).toBe(true);
    expect(resolveAs(conflict.ledger, r.reportId, 'uphold_mentee_no_show').ok).toBe(true);
  });

  it('treats a technical report as having no accused party', () => {
    const { ledger, session, report: r } = opened({ type: 'technical' });
    expect(dueProcessSatisfied(r, session, NO_SHOW_NOW)).toBe(true);
    expect(resolveAs(ledger, r.reportId, 'technical_issue').ok).toBe(true);
  });

  it.each([
    ['uphold_mentor_no_show', 'refund_mentee'],
    ['uphold_mentee_no_show', 'compensate_mentor'],
    ['uphold_both_absent', 'none'],
    ['technical_issue', 'none'],
    ['dismiss', 'none'],
  ] as const)('maps %s to the consequence %s and emits one event without the note', (outcome, consequence) => {
    const { ledger, report: r } = opened();
    const later = new Date(Date.parse(r.responseDeadline));
    const result = ok(resolveAs(ledger, r.reportId, outcome, later));

    expect(result.report).toMatchObject({ status: 'resolved', outcome, consequence, resolvedBy: coordinatorActor.userId });
    expect(result.report.resolutionNote).toBe('Reviewed the call logs');
    const events = result.ledger.events.filter((event) => event.type === 'mentorship.session.no_show_resolved');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ resolution: outcome, consequence });
    expect(JSON.stringify(events[0])).not.toContain('call logs');
    expect(result.ledger.settlements).toHaveLength(0);
  });

  it('refuses participants and coordinators of another tenant', () => {
    const { ledger, report: r } = opened();
    expect(code(resolveAs(ledger, r.reportId, 'dismiss', NO_SHOW_NOW, mentorActor))).toBe('NOT_AUTHORIZED');
    expect(code(resolveAs(ledger, r.reportId, 'dismiss', NO_SHOW_NOW, { ...coordinatorActor, tenantId: 'tenant-b' }))).toBe('NOT_AUTHORIZED');
    expect(code(resolveAs(ledger, 'nsr-nope', 'dismiss'))).toBe('NOT_AUTHORIZED');
  });

  it('is idempotent for the same outcome and refuses a different one', () => {
    const { ledger, report: r } = opened();
    const first = ok(resolveAs(ledger, r.reportId, 'dismiss'));
    const again = ok(resolveAs(first.ledger, r.reportId, 'dismiss'));
    expect(again.replayed).toBe(true);
    expect(again.ledger).toBe(first.ledger);
    expect(code(resolveAs(first.ledger, r.reportId, 'technical_issue'))).toBe('NO_SHOW_ALREADY_RESOLVED');
  });

  it('validates the outcome and the note', () => {
    const { ledger, report: r } = opened();
    expect(code(resolveAs(ledger, r.reportId, 'guilty' as never))).toBe('INVALID_SESSION');
    expect(
      code(resolveNoShowReport(ledger, { actor: coordinatorActor, reportId: r.reportId, outcome: 'dismiss', note: '<b>x</b>' }, NO_SHOW_NOW)),
    ).toBe('INVALID_SESSION');
  });
});

describe('automatic consequences wait for policy', () => {
  const afterDeadline = (r: { responseDeadline: string }) => new Date(Date.parse(r.responseDeadline) + HOUR);
  const enabled = { autoConsequences: true };

  it('does nothing with the default policy, however long it waits', () => {
    const { ledger, report: r } = opened();
    const result = applyDueConsequences(ledger, { autoConsequences: false }, afterDeadline(r));
    expect(result.resolved).toEqual([]);
    expect(result.ledger).toBe(ledger);
    expect(result.ledger.noShowReports[0]).toMatchObject({ status: 'open', consequence: 'pending_policy' });
  });

  it('acts only after the response deadline, then marks the system as the resolver', () => {
    const { ledger, report: r } = opened();
    expect(applyDueConsequences(ledger, enabled, new Date(Date.parse(r.responseDeadline) - 1)).resolved).toEqual([]);

    const result = applyDueConsequences(ledger, enabled, afterDeadline(r));
    expect(result.resolved).toEqual([r.reportId]);
    expect(result.ledger.noShowReports[0]).toMatchObject({
      status: 'resolved',
      outcome: 'uphold_mentor_no_show',
      consequence: 'refund_mentee',
      resolvedBy: 'system',
    });
    expect(result.ledger.events.filter((event) => event.type === 'mentorship.session.no_show_resolved')).toHaveLength(1);
  });

  it('is idempotent: running it again resolves nothing and adds no event', () => {
    const { ledger, report: r } = opened();
    const first = applyDueConsequences(ledger, enabled, afterDeadline(r));
    const second = applyDueConsequences(first.ledger, enabled, afterDeadline(r));
    expect(second.resolved).toEqual([]);
    expect(second.ledger.events).toHaveLength(first.ledger.events.length);
  });

  it('never acts on a contested, conflicting, mutual or technical report', () => {
    const answered = opened();
    const withResponse = ok(respond(answered.ledger, answered.report.reportId));
    expect(applyDueConsequences(withResponse.ledger, enabled, afterDeadline(answered.report)).resolved).toEqual([]);

    const base = opened();
    const conflict = ok(mentorReports(base.ledger, base.session.sessionId));
    expect(applyDueConsequences(conflict.ledger, enabled, afterDeadline(base.report)).resolved).toEqual([]);

    for (const type of ['both', 'technical'] as const) {
      const other = opened({ type });
      expect(applyDueConsequences(other.ledger, enabled, afterDeadline(other.report)).resolved).toEqual([]);
    }
  });

  it('applies the mentee consequence when a mentor reports a mentee no-show', () => {
    const { ledger, session } = bookedLedger();
    const created = ok(mentorReports(ledger, session.sessionId));
    const result = applyDueConsequences(created.ledger, enabled, afterDeadline(created.report));
    expect(result.ledger.noShowReports[0]).toMatchObject({ outcome: 'uphold_mentee_no_show', consequence: 'compensate_mentor' });
  });
});

describe('restricted evidence', () => {
  const full = () => {
    const { ledger, session } = bookedLedger();
    const created = ok(report(ledger, session.sessionId, { evidence: [{ kind: 'note', text: 'Waited 15 minutes' }, ATTACHMENT] }));
    const answered = ok(
      respond(created.ledger, created.report.reportId, mentorActor, { evidence: [{ kind: 'note', text: 'Logged in' }, { ...ATTACHMENT, attachmentRef: 'att-0002-wxyz' }] }),
    );
    return { report: answered.report, session };
  };

  it('hides the report from other tenants and from anyone who is not a party', () => {
    const { report: r, session } = full();
    expect(redactNoShowReportFor(r, session, { ...coordinatorActor, tenantId: 'tenant-b' })).toBeNull();
    expect(redactNoShowReportFor(r, session, { userId: 'user-mentor-2', role: 'mentor', tenantId: 'tenant-a' })).toBeNull();
    expect(redactNoShowReportFor(r, session, { userId: 'user-mentee-2', role: 'mentee', tenantId: 'tenant-a' })).toBeNull();
  });

  it('gives coordinators everything', () => {
    const { report: r, session } = full();
    expect(redactNoShowReportFor(r, session, coordinatorActor)).toEqual(r);
  });

  it("shows the accused the claim and its notes but not the reporter's attachment", () => {
    const { report: r, session } = full();
    const seen = redactNoShowReportFor(r, session, mentorActor);
    expect(seen?.claims[0].statement).toBe(STATEMENT);
    expect(seen?.claims[0].evidence).toEqual([{ kind: 'note', text: 'Waited 15 minutes' }, { kind: 'attachment', restricted: true }]);
    expect(JSON.stringify(seen?.claims)).not.toContain('att-0001');
    expect(seen?.responses[0].evidence).toEqual([{ kind: 'note', text: 'Logged in' }, { ...ATTACHMENT, attachmentRef: 'att-0002-wxyz' }]);
  });

  it("shows the reporter the response notes but not the accused's attachment", () => {
    const { report: r, session } = full();
    const seen = redactNoShowReportFor(r, session, menteeActor);
    expect(seen?.claims[0].evidence).toEqual(r.claims[0].evidence);
    expect(seen?.responses[0].evidence).toEqual([{ kind: 'note', text: 'Logged in' }, { kind: 'attachment', restricted: true }]);
    expect(JSON.stringify(seen?.responses)).not.toContain('att-0002');
  });

  it('does not alter the stored report', () => {
    const { report: r, session } = full();
    const before = JSON.stringify(r);
    redactNoShowReportFor(r, session, mentorActor);
    expect(JSON.stringify(r)).toBe(before);
  });
});
