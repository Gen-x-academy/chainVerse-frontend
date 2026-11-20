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

  // CAPSTONE-097: consent-aware originality checks
  integrityChecks: (identity: Identity, projectId: string) =>
    ['integrityChecks', ...identityScope(identity), projectId] as const,

  // CAPSTONE-098: ethics screenings
  ethicsScreenings: (identity: Identity, projectId: string) =>
    ['ethicsScreenings', ...identityScope(identity), projectId] as const,

  // CAPSTONE-099: integrity concern reports
  integrityReports: (identity: Identity, projectId: string) =>
    ['integrityReports', ...identityScope(identity), projectId] as const,

  // CAPSTONE-102: project disputes
  projectDisputes: (identity: Identity, projectId: string) =>
    ['projectDisputes', ...identityScope(identity), projectId] as const,
};
