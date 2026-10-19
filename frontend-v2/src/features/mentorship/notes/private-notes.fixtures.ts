import type { PrivateNote } from './private-notes';

export const FIXTURE_MENTOR_ID = 'usr_fixture_mentor';
export const FIXTURE_MENTEE_ID = 'usr_fixture_mentee';
export const FIXTURE_REVIEWER_ID = 'usr_fixture_reviewer';

/** Deterministic, synthetic notes; no real people or content. */
export const PRIVATE_NOTE_FIXTURES: readonly PrivateNote[] = [
  {
    id: 'note_001',
    engagementId: 'eng_fixture_1',
    ownerId: FIXTURE_MENTOR_ID,
    body: 'Revisit escrow release timing next session.',
    version: 1,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
  },
  {
    id: 'note_002',
    engagementId: 'eng_fixture_1',
    ownerId: FIXTURE_MENTOR_ID,
    body: 'Prepare Soroban reading list.',
    version: 2,
    createdAt: '2026-01-06T10:00:00.000Z',
    updatedAt: '2026-01-07T10:00:00.000Z',
    retentionHold: true,
  },
  {
    id: 'note_003',
    engagementId: 'eng_fixture_1',
    ownerId: FIXTURE_MENTEE_ID,
    body: 'Ask about portfolio feedback.',
    version: 1,
    createdAt: '2026-01-05T11:00:00.000Z',
    updatedAt: '2026-01-05T11:00:00.000Z',
  },
  {
    id: 'note_004',
    engagementId: 'eng_fixture_1',
    ownerId: FIXTURE_MENTOR_ID,
    body: 'Deleted draft.',
    version: 3,
    createdAt: '2026-01-04T10:00:00.000Z',
    updatedAt: '2026-01-08T10:00:00.000Z',
    deletedAt: '2026-01-08T10:00:00.000Z',
  },
];
