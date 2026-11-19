/**
 * Query-key factory for issue #831.
 * Every key is scoped by the authenticated identity (and wallet, where
 * relevant) so cached React Query data can never leak across accounts.
 *
 * Workspace keys (CAPSTONE-067/069/077/078) additionally include tenant and
 * project scope so caches can never leak across tenants or projects.
 */

type Identity = {
  userId: string;
  role: 'student' | 'instructor' | 'organization';
  walletAddress?: string;
  network?: string;
};

/**
 * Tenant/project scope for workspace resources. `tenantId` is required so a
 * missing scope can never silently fall back to a shared cache bucket.
 */
type WorkspaceScope = {
  tenantId: string;
  projectId: string;
};

type Pagination = {
  cursor?: string;
  limit?: number;
};

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

  /**
   * Workspace module (CAPSTONE-067/069/077/078).
   * All keys are tenant- and project-scoped; private resources are further
   * scoped by owner identity so owner-only data never shares a cache entry.
   */
  workspace: {
    /**
     * Private researcher notes (CAPSTONE-067). Owner-only: the owner id is
     * part of every key so notes are never served from another user's cache.
     */
    notes: {
      all: (scope: WorkspaceScope, ownerId: string) =>
        ['workspace', scope.tenantId, scope.projectId, 'notes', ownerId] as const,
      list: (scope: WorkspaceScope, ownerId: string, pagination?: Pagination) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'notes',
          ownerId,
          'list',
          pagination?.cursor ?? 'first',
          pagination?.limit ?? 'default',
        ] as const,
      detail: (scope: WorkspaceScope, ownerId: string, noteId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'notes',
          ownerId,
          'detail',
          noteId,
        ] as const,
    },

    /**
     * Project discussion threads (CAPSTONE-069). Messages are paginated with a
     * stable ordering; attachments are keyed per message.
     */
    discussions: {
      all: (scope: WorkspaceScope) =>
        ['workspace', scope.tenantId, scope.projectId, 'discussions'] as const,
      threads: (scope: WorkspaceScope, pagination?: Pagination) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'discussions',
          'threads',
          pagination?.cursor ?? 'first',
          pagination?.limit ?? 'default',
        ] as const,
      thread: (scope: WorkspaceScope, threadId: string) =>
        ['workspace', scope.tenantId, scope.projectId, 'discussions', 'thread', threadId] as const,
      messages: (scope: WorkspaceScope, threadId: string, pagination?: Pagination) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'discussions',
          'thread',
          threadId,
          'messages',
          pagination?.cursor ?? 'first',
          pagination?.limit ?? 'default',
        ] as const,
      attachments: (scope: WorkspaceScope, threadId: string, messageId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'discussions',
          'thread',
          threadId,
          'message',
          messageId,
          'attachments',
        ] as const,
    },

    /**
     * Review outcome aggregations (CAPSTONE-077), scoped by proposal and
     * review round.
     */
    reviewAggregations: {
      all: (scope: WorkspaceScope, proposalId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'reviews',
          'aggregation',
          proposalId,
        ] as const,
      byRound: (scope: WorkspaceScope, proposalId: string, reviewRoundId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'reviews',
          'aggregation',
          proposalId,
          'round',
          reviewRoundId,
        ] as const,
    },

    /**
     * Proposal revision requests (CAPSTONE-078), scoped by proposal and the
     * exact proposal version the request is tied to.
     */
    revisionRequests: {
      all: (scope: WorkspaceScope, proposalId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'revision-requests',
          proposalId,
        ] as const,
      byVersion: (scope: WorkspaceScope, proposalId: string, proposalVersionId: string) =>
        [
          'workspace',
          scope.tenantId,
          scope.projectId,
          'revision-requests',
          proposalId,
          'version',
          proposalVersionId,
        ] as const,
    },
  },
};
</｜｜DSML｜｜ parameter>