import type { SessionWorkspaceData } from './workspace';

export const FIXTURE_MENTOR = 'usr_fixture_mentor';
export const FIXTURE_MENTEE = 'usr_fixture_mentee';
export const FIXTURE_STAFF = 'usr_fixture_staff';
export const FIXTURE_OUTSIDER = 'usr_fixture_outsider';

export const NOW = new Date('2026-03-01T12:00:00.000Z');

/** Deterministic, synthetic workspace for a scheduled session. */
export const FIXTURE_WORKSPACE: SessionWorkspaceData = {
  sessionId: 'ses_fixture_1',
  engagementId: 'eng_fixture_1',
  status: 'scheduled',
  scheduledStart: '2026-03-02T10:00:00.000Z',
  scheduledEnd: '2026-03-02T11:00:00.000Z',
  participantIds: [FIXTURE_MENTOR, FIXTURE_MENTEE],
  scopedStaffIds: [FIXTURE_STAFF],
  retainUntil: '2027-03-02T11:00:00.000Z',
  version: 3,
  agenda: [
    { id: 'itm_1', title: 'Escrow basics', state: 'open' },
    { id: 'itm_2', title: 'Portfolio review', state: 'resolved' },
  ],
  goals: [
    { id: 'g1', title: 'Ship a first Soroban contract', done: false },
    { id: 'g2', title: 'Write a project README', done: true },
  ],
  resources: [
    { id: 'r1', title: 'Soroban docs', url: 'https://developers.stellar.org', audience: 'participants-and-staff' },
    { id: 'r2', title: 'Private reading list', url: 'https://example.com/list', audience: 'participants' },
    { id: 'r3', title: 'Unsafe link', url: 'javascript:alert(1)', audience: 'participants' },
  ],
  attendance: [
    { participantId: FIXTURE_MENTOR, status: 'not-started' },
    { participantId: FIXTURE_MENTEE, status: 'not-started' },
  ],
  followUps: [
    { id: 'fu_1', title: 'Share draft contract', ownerId: FIXTURE_MENTEE, done: false, createdBy: FIXTURE_MENTOR },
  ],
  appliedCommandIds: ['seed-1'],
};
