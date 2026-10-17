/**
 * MENTOR-007 seed data. Import from this folder directly; the feature
 * entrypoint stays LIMITED to the shared vocabulary surface (see index.ts).
 */
export {
  MENTORSHIP_SEED_VERSION,
  MENTORSHIP_STORAGE_PREFIX,
  buildMentorshipSeedDataset,
  clearPersistedMentorshipState,
  engagementIdsAreWellFormed,
  resetMentorshipSeedData,
  seedDataIsSynthetic,
  SESSION_SEED_STATUSES,
  DELIVERABLE_SEED_STATUSES,
} from './dataset';
export type {
  MentorshipSeedOptions,
  MentorshipSeedDataset,
  ExtendedMentorshipSeedDataset,
  SeedOrganization,
  SeedMentor,
  SeedMentee,
  SeedProgram,
  SeedEngagement,
  SeedSession,
  SeedDeliverable,
  SeedPayment,
  SeedDispute,
} from './dataset';
