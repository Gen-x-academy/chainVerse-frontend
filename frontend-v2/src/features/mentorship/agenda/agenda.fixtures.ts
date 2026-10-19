import type { Agenda, AgendaCommand, AgendaCommandEnvelope } from './agenda';

export const FIXTURE_MENTOR = 'usr_fixture_mentor';
export const FIXTURE_MENTEE = 'usr_fixture_mentee';
export const FIXTURE_OUTSIDER = 'usr_fixture_outsider';
export const FIXTURE_COORDINATOR = 'usr_fixture_coordinator';

/** Session starts at 10:00 UTC; the default cutoff is 09:00. */
export const FIXTURE_AGENDA: Agenda = {
  sessionId: 'ses_fixture_1',
  sessionStart: '2026-03-02T10:00:00.000Z',
  participantIds: [FIXTURE_MENTOR, FIXTURE_MENTEE],
  version: 0,
  items: [],
  history: [],
};

export const BEFORE_CUTOFF = new Date('2026-03-01T12:00:00.000Z');
export const AFTER_CUTOFF = new Date('2026-03-02T09:30:00.000Z');

export function envelope(
  commandId: string,
  baseVersion: number,
  command: AgendaCommand,
): AgendaCommandEnvelope {
  return { commandId, baseVersion, command };
}
