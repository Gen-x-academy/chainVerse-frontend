import { describe, expect, it } from 'vitest';
import {
  AttendanceError,
  DEFAULT_ATTENDANCE_POLICY as POLICY,
  canViewAttendance,
  computeAttendance,
  createCorrectionRequest,
  decideCorrection,
  isCorroborated,
  partitionExpiredSignals,
  redactCorrectionForLog,
  toAttendanceError,
  validateSignalInput,
} from '../attendance';
import {
  FIXTURE_COORDINATOR,
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  FIXTURE_SESSION as S,
  FIXTURE_SIGNALS,
  signal,
} from '../attendance.fixtures';

const mentor = { userId: FIXTURE_MENTOR };
const mentee = { userId: FIXTURE_MENTEE };
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AttendanceError).code;
  }
  return null;
};

describe('authorization (deny-by-default)', () => {
  it('allows participants and coordinators only', () => {
    expect(canViewAttendance(mentor, S)).toBe(true);
    expect(canViewAttendance({ userId: FIXTURE_COORDINATOR, isCoordinator: true }, S)).toBe(true);
    expect(canViewAttendance({ userId: FIXTURE_OUTSIDER }, S)).toBe(false);
    expect(canViewAttendance({ userId: null }, S)).toBe(false);
    expect(canViewAttendance({ userId: FIXTURE_COORDINATOR }, S)).toBe(false);
  });
});

describe('computeAttendance', () => {
  it('represents full and partial attendance', () => {
    const [mentorRow, menteeRow] = computeAttendance(S, FIXTURE_SIGNALS);
    expect(mentorRow).toMatchObject({ participantId: FIXTURE_MENTEE });
    expect(menteeRow).toMatchObject({ status: 'attended', presentMinutes: 60, ratio: 1 });
    expect(mentorRow).toMatchObject({ status: 'partial', presentMinutes: 20 });
  });

  it('is deterministic regardless of input order', () => {
    const a = computeAttendance(S, FIXTURE_SIGNALS);
    const b = computeAttendance(S, [...FIXTURE_SIGNALS].reverse());
    expect(b).toEqual(a);
  });

  it('cannot be self-awarded when corroboration is required', () => {
    const signals = [
      signal('a', FIXTURE_MENTEE, 'join', 'self-report', '2026-03-02T10:00:00.000Z'),
      signal('b', FIXTURE_MENTEE, 'leave', 'self-report', '2026-03-02T11:00:00.000Z'),
    ];
    const row = computeAttendance(S, signals).find((r) => r.participantId === FIXTURE_MENTEE)!;
    expect(row.status).toBe('pending-corroboration');
    expect(row.presentMinutes).toBe(0);
  });

  it('counts self-reports when policy does not require corroboration', () => {
    const signals = [
      signal('a', FIXTURE_MENTEE, 'join', 'self-report', '2026-03-02T10:00:00.000Z'),
      signal('b', FIXTURE_MENTEE, 'leave', 'self-report', '2026-03-02T11:00:00.000Z'),
    ];
    const row = computeAttendance(S, signals, [], { ...POLICY, requireCorroboration: false }).find(
      (r) => r.participantId === FIXTURE_MENTEE,
    )!;
    expect(row.status).toBe('attended');
  });

  it('counts counterpart confirmation only from a different participant', () => {
    const ok = signal('a', FIXTURE_MENTEE, 'join', 'counterpart-confirmation', '2026-03-02T10:00:00.000Z', {
      attestedBy: FIXTURE_MENTOR,
    });
    const selfAttested = { ...ok, attestedBy: FIXTURE_MENTEE };
    expect(isCorroborated(ok)).toBe(true);
    expect(isCorroborated(selfAttested)).toBe(false);
    expect(isCorroborated({ ...ok, attestedBy: undefined })).toBe(false);
  });

  it('caps a join with no leave and clips to the session window', () => {
    const signals = [signal('a', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T10:10:00.000Z')];
    const row = computeAttendance(S, signals).find((r) => r.participantId === FIXTURE_MENTEE)!;
    expect(row.presentMinutes).toBe(POLICY.maxUnclosedMinutes);
    expect(row.status).toBe('absent');

    const early = [
      signal('a', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T09:50:00.000Z'),
      signal('b', FIXTURE_MENTEE, 'leave', 'platform-presence', '2026-03-02T10:30:00.000Z'),
    ];
    expect(
      computeAttendance(S, early).find((r) => r.participantId === FIXTURE_MENTEE)!.presentMinutes,
    ).toBe(30);
  });

  it('merges rejoins without double counting', () => {
    const signals = [
      signal('a', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T10:00:00.000Z'),
      signal('b', FIXTURE_MENTEE, 'leave', 'platform-presence', '2026-03-02T10:20:00.000Z'),
      signal('c', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T10:30:00.000Z'),
      signal('d', FIXTURE_MENTEE, 'leave', 'platform-presence', '2026-03-02T10:50:00.000Z'),
    ];
    expect(
      computeAttendance(S, signals).find((r) => r.participantId === FIXTURE_MENTEE)!.presentMinutes,
    ).toBe(40);
  });
});

describe('validateSignalInput', () => {
  const base = { kind: 'join', method: 'platform-presence', at: '2026-03-02T10:00:00.000Z' };

  it('accepts a participant recording themselves', () => {
    expect(validateSignalInput(mentee, S, FIXTURE_MENTEE, base)).toMatchObject({ kind: 'join' });
  });

  it.each(['latitude', 'location', 'ip', 'deviceId', 'biometric', 'userAgent'])(
    'rejects %s as a privacy violation',
    (key) => {
      expect(code(() => validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, [key]: 'x' }))).toBe(
        'PRIVACY_VIOLATION',
      );
    },
  );

  it('rejects unknown fields, bad values and outsiders', () => {
    expect(code(() => validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, extra: 1 }))).toBe('INVALID_SIGNAL');
    expect(code(() => validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, kind: 'x' }))).toBe('INVALID_SIGNAL');
    expect(code(() => validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, at: 'nope' }))).toBe('INVALID_SIGNAL');
    expect(code(() => validateSignalInput({ userId: FIXTURE_OUTSIDER }, S, FIXTURE_MENTEE, base))).toBe('NOT_AUTHORIZED');
    expect(code(() => validateSignalInput({ userId: null }, S, FIXTURE_MENTEE, base))).toBe('NOT_AUTHORIZED');
  });

  it('prevents recording for someone else except by counterpart confirmation', () => {
    expect(code(() => validateSignalInput(mentor, S, FIXTURE_MENTEE, base))).toBe('NOT_AUTHORIZED');
    const confirm = { ...base, method: 'counterpart-confirmation', attestedBy: FIXTURE_MENTOR };
    expect(validateSignalInput(mentor, S, FIXTURE_MENTEE, confirm).attestedBy).toBe(FIXTURE_MENTOR);
    expect(code(() => validateSignalInput(mentor, S, FIXTURE_MENTOR, confirm))).toBe('NOT_AUTHORIZED');
    expect(code(() => validateSignalInput(mentor, S, FIXTURE_MENTEE, { ...confirm, attestedBy: FIXTURE_MENTEE }))).toBe('NOT_AUTHORIZED');
  });

  it('enforces the session window with grace', () => {
    expect(code(() => validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, at: '2026-03-02T09:30:00.000Z' }))).toBe('OUTSIDE_WINDOW');
    expect(validateSignalInput(mentee, S, FIXTURE_MENTEE, { ...base, at: '2026-03-02T09:46:00.000Z' })).toBeTruthy();
  });
});

describe('corrections are auditable', () => {
  const at = new Date('2026-03-03T00:00:00.000Z');
  const request = () =>
    createCorrectionRequest(mentee, S, { id: 'c1', participantId: FIXTURE_MENTEE, reason: ' my network dropped ', proposedStatus: 'attended' }, at);

  it('records the request in an append-only audit trail', () => {
    const c = request();
    expect(c).toMatchObject({ state: 'requested', reason: 'my network dropped', requestedBy: FIXTURE_MENTEE });
    expect(c.audit).toEqual([{ action: 'requested', actorId: FIXTURE_MENTEE, at: at.toISOString() }]);
  });

  it('validates the request', () => {
    const bad = (over: object) =>
      code(() => createCorrectionRequest(mentee, S, { id: 'c', participantId: FIXTURE_MENTEE, reason: 'r', proposedStatus: 'attended', ...over }, at));
    expect(bad({ reason: '  ' })).toBe('INVALID_CORRECTION');
    expect(bad({ reason: 'x'.repeat(501) })).toBe('INVALID_CORRECTION');
    expect(bad({ proposedStatus: 'bogus' })).toBe('INVALID_CORRECTION');
    expect(bad({ proposedMinutes: -1 })).toBe('INVALID_CORRECTION');
    expect(bad({ participantId: FIXTURE_OUTSIDER })).toBe('NOT_AUTHORIZED');
    expect(code(() => createCorrectionRequest({ userId: FIXTURE_OUTSIDER }, S, { id: 'c', participantId: FIXTURE_MENTEE, reason: 'r', proposedStatus: 'attended' }, at))).toBe('NOT_AUTHORIZED');
  });

  it('blocks self-approval and outsiders', () => {
    expect(code(() => decideCorrection(mentee, S, request(), 'approved', at))).toBe('SELF_APPROVAL');
    expect(code(() => decideCorrection({ userId: FIXTURE_OUTSIDER }, S, request(), 'approved', at))).toBe('NOT_AUTHORIZED');
  });

  it('approves, audits, applies, and is retry-safe', () => {
    const decided = decideCorrection(mentor, S, request(), 'approved', at);
    expect(decided.audit.map((a) => a.action)).toEqual(['requested', 'approved']);
    expect(decideCorrection(mentor, S, decided, 'approved', at)).toBe(decided);
    expect(code(() => decideCorrection(mentor, S, decided, 'rejected', at))).toBe('ALREADY_DECIDED');

    const row = computeAttendance(S, [], [decided]).find((r) => r.participantId === FIXTURE_MENTEE)!;
    expect(row).toMatchObject({ status: 'attended', corrected: true });
  });

  it('ignores rejected corrections and lets coordinators decide', () => {
    const coordinator = { userId: FIXTURE_COORDINATOR, isCoordinator: true };
    const rejected = decideCorrection(coordinator, S, request(), 'rejected', at);
    const row = computeAttendance(S, [], [rejected]).find((r) => r.participantId === FIXTURE_MENTEE)!;
    expect(row.corrected).toBe(false);
    expect(row.status).toBe('absent');
  });

  it('keeps reasons out of logs', () => {
    const logged = redactCorrectionForLog(request());
    expect(JSON.stringify(logged)).not.toContain('network');
    expect(logged.reasonLength).toBe(18);
  });
});

describe('raw signal retention', () => {
  it('expires raw signals by policy while the summary is unaffected', () => {
    const old = signal('old', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T10:00:00.000Z', {
      receivedAt: '2026-01-01T00:00:00.000Z',
    });
    const now = new Date('2026-03-03T00:00:00.000Z');
    const { kept, expired } = partitionExpiredSignals([old, ...FIXTURE_SIGNALS], POLICY, now);
    expect(expired.map((s) => s.id)).toEqual(['old']);
    expect(kept).toHaveLength(FIXTURE_SIGNALS.length);
    expect(computeAttendance(S, FIXTURE_SIGNALS)).toEqual(computeAttendance(S, kept));
  });
});

describe('error mapping', () => {
  it('uses stable codes and fixed messages', () => {
    expect(toAttendanceError({ status: 404, message: 'secret' }).code).toBe('NOT_FOUND');
    expect(toAttendanceError({ status: 409 }).code).toBe('ALREADY_DECIDED');
    expect(toAttendanceError({ status: 422 }).code).toBe('INVALID_SIGNAL');
    expect(toAttendanceError(new Error('secret')).message).not.toContain('secret');
  });
});
