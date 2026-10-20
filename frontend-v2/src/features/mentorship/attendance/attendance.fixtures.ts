import type { AttendanceSession, AttendanceSignal } from './attendance';

export const FIXTURE_MENTOR = 'usr_fixture_mentor';
export const FIXTURE_MENTEE = 'usr_fixture_mentee';
export const FIXTURE_OUTSIDER = 'usr_fixture_outsider';
export const FIXTURE_COORDINATOR = 'usr_fixture_coordinator';

/** 60-minute session, deterministic and synthetic. */
export const FIXTURE_SESSION: AttendanceSession = {
  id: 'ses_fixture_1',
  scheduledStart: '2026-03-02T10:00:00.000Z',
  scheduledEnd: '2026-03-02T11:00:00.000Z',
  participantIds: [FIXTURE_MENTOR, FIXTURE_MENTEE],
};

export function signal(
  id: string,
  participantId: string,
  kind: AttendanceSignal['kind'],
  method: AttendanceSignal['method'],
  at: string,
  extra: Partial<AttendanceSignal> = {},
): AttendanceSignal {
  return {
    id,
    sessionId: FIXTURE_SESSION.id,
    participantId,
    kind,
    method,
    at,
    receivedAt: at,
    ...extra,
  };
}

export const FIXTURE_SIGNALS: readonly AttendanceSignal[] = [
  signal('s1', FIXTURE_MENTOR, 'join', 'platform-presence', '2026-03-02T10:00:00.000Z'),
  signal('s2', FIXTURE_MENTOR, 'leave', 'platform-presence', '2026-03-02T11:00:00.000Z'),
  signal('s3', FIXTURE_MENTEE, 'join', 'platform-presence', '2026-03-02T10:30:00.000Z'),
  signal('s4', FIXTURE_MENTEE, 'leave', 'platform-presence', '2026-03-02T10:50:00.000Z'),
];
