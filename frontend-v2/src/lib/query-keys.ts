/**
 * Query-key factory for issue #831.
 * Every key is scoped by the authenticated identity (and wallet, where
 * relevant) so cached React Query data can never leak across accounts.
 *
 * Workspace keys (CAPSTONE-070/071/073/075) are additionally scoped by
 * `identity.tenantId` so cached data can never leak across tenants.
 */

type Identity = {
  userId: string;
  role: 'student' | 'instructor' | 'organization';
  walletAddress?: string;
  network?: string;
  tenantId?: string;
};

/**
 * Shared identity scope prefix. Always includes role, userId and tenantId so
 * every workspace key is both account- and tenant-scoped.
 */
const identityScope = (identity: Identity) =>
  [identity.role, identity.userId, identity.tenantId ?? 'no-tenant'] as const;

export const queryKeys = {
  profile: (identity: Identity) => ['profile', identity.role, identity.userId] as const,

  courses: (identity: Identity) => ['courses', identity.role, identity.userId] as const,

  notifications: (identity: Identity) =>
    ['notifications', identity.role, identity.userId] as const,

  dashboard: (identity: Identity) => ['dashboard', identity.role, identity.userId] as const,

  wallet: (identity: Identity) =>
    [
      'wallet',
      identity.userId,
      identity.walletAddress ?? 'disconnected',
      identity.network ?? 'unknown',
    ] as const,

  // CAPSTONE-070: project decisions
  decisions: (identity: Identity, projectId: string) =>
    ['decisions', ...identityScope(identity), projectId] as const,

  decision: (identity: Identity, id: string) =>
    ['decision', ...identityScope(identity), id] as const,

  // CAPSTONE-071: source-control references
  sourceControlConnections: (identity: Identity) =>
    ['sourceControlConnections', ...identityScope(identity)] as const,

  sourceControlReferences: (identity: Identity, projectId: string) =>
    ['sourceControlReferences', ...identityScope(identity), projectId] as const,

  // CAPSTONE-073: proposal review queues
  reviewQueue: (identity: Identity, filters: Record<string, unknown> = {}) =>
    ['reviewQueue', ...identityScope(identity), filters] as const,

  // CAPSTONE-075: independent proposal reviews
  review: (identity: Identity, id: string) =>
    ['review', ...identityScope(identity), id] as const,

  reviewsForSubmission: (identity: Identity, submissionVersionId: string) =>
    ['reviewsForSubmission', ...identityScope(identity), submissionVersionId] as const,

  // CAPSTONE-066: collaborative project notes
  notes: (identity: Identity, projectId: string) =>
    ['notes', ...identityScope(identity), projectId] as const,

  note: (identity: Identity, noteId: string) =>
    ['note', ...identityScope(identity), noteId] as const,

  noteRevisions: (identity: Identity, noteId: string) =>
    ['noteRevisions', ...identityScope(identity), noteId] as const,

  // CAPSTONE-072: project activity feed
  activity: (identity: Identity, projectId: string, filters: Record<string, unknown> = {}) =>
    ['activity', ...identityScope(identity), projectId, filters] as const,

  activityReadState: (identity: Identity, projectId: string) =>
    ['activityReadState', ...identityScope(identity), projectId] as const,

  // CAPSTONE-074: configurable review rubrics
  rubrics: (identity: Identity, projectId: string) =>
    ['rubrics', ...identityScope(identity), projectId] as const,

  rubric: (identity: Identity, rubricId: string) =>
    ['rubric', ...identityScope(identity), rubricId] as const,

  rubricVersions: (identity: Identity, rubricId: string) =>
    ['rubricVersions', ...identityScope(identity), rubricId] as const,

  // CAPSTONE-076: blinded review modes
  blindingConfig: (identity: Identity, projectId: string) =>
    ['blindingConfig', ...identityScope(identity), projectId] as const,

  blindedReviewQueue: (
    identity: Identity,
    projectId: string,
    filters: Record<string, unknown> = {},
  ) => ['blindedReviewQueue', ...identityScope(identity), projectId, filters] as const,

  blindedReviewExport: (identity: Identity, projectId: string) =>
    ['blindedReviewExport', ...identityScope(identity), projectId] as const,
};
