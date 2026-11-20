/**
 * frontend-v2/src/services/api.ts
 *
 * Typed API service clients for the capstone / research-project workspace.
 *
 * Covers:
 *  - CAPSTONE-066: collaborative project notes (list/create/update/archive)
 *  - CAPSTONE-072: project activity feed (cursor pagination, read state)
 *  - CAPSTONE-074: configurable review rubrics (versioned criteria, publish)
 *  - CAPSTONE-076: blinded review modes (blinded queue/export projections)
 *
 * Design notes:
 *  - All mutations carry an idempotency key so retries cannot duplicate side
 *    effects (notes, read state, rubric saves/publishes).
 *  - All updates carry an `expectedVersion` via `If-Match` so stale revisions
 *    surface a stable `ApiConflictError` instead of silently overwriting.
 *  - Every request is tenant-scoped. Tenant scope is passed explicitly and is
 *    never inferred from untrusted input.
 *  - No private payloads (note bodies, rubric guidance, reviewer identities)
 *    are ever logged. Errors carry only stable codes and safe metadata.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * Stable, actionable error codes surfaced to the UI. These are intentionally
 * coarse so the frontend can render deterministic messaging without leaking
 * server internals or private payloads.
 */
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'network_error'
  | 'server_error'
  | 'unknown';

/** Base error for all API failures. Never carries private payloads. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Safe, non-sensitive metadata (e.g. field names, retry-after seconds). */
  readonly meta: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    meta: Record<string, string | number | boolean> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.meta = Object.freeze({ ...meta });
  }
}

/**
 * Raised when a mutation is rejected because the caller's `expectedVersion`
 * is stale (HTTP 409 / 412). The UI should prompt the user to reload and
 * re-apply their change rather than retrying blindly.
 */
export class ApiConflictError extends ApiError {
  /** The server's current version, when provided. Safe to display. */
  readonly currentVersion?: number;

  constructor(
    status: number,
    message: string,
    currentVersion?: number,
    meta: Record<string, string | number | boolean> = {},
  ) {
    super('conflict', status, message, meta);
    this.name = 'ApiConflictError';
    this.currentVersion = currentVersion;
  }
}

/** Tenant scope required on every request. */
export interface TenantScope {
  readonly tenantId: string;
}

/** Standard cursor-paginated envelope returned by list endpoints. */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

/** Options accepted by every service call. */
export interface RequestOptions {
  /** Abort signal for cancellation on unmount / navigation. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Shared apiClient contract
// ---------------------------------------------------------------------------

/**
 * Minimal contract for the shared HTTP client. The concrete implementation
 * lives in `frontend-v2/src/lib/api-client.ts`; services depend only on this
 * interface so they remain testable with deterministic fixtures.
 */
export interface ApiRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface ApiResponse<T> {
  readonly status: number;
  readonly data: T;
  /** Response headers, lower-cased. Used to read `ETag` / version hints. */
  readonly headers: Readonly<Record<string, string>>;
}

export interface ApiClient {
  request<T>(req: ApiRequest): Promise<ApiResponse<T>>;
}

// ---------------------------------------------------------------------------
// Idempotency + version helpers
// ---------------------------------------------------------------------------

/**
 * Generates a client-side idempotency key. Uses `crypto.randomUUID` when
 * available and falls back to a v4-shaped random string otherwise. Keys are
 * opaque and contain no tenant or user identifiers.
 */
export function createIdempotencyKey(): string {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  // RFC 4122 v4 fallback. Not cryptographically strong, but sufficient as a
  // dedupe token for retries within a short window.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[(Math.random() * 4) | 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}

/** Builds the `If-Match` header value for optimistic concurrency. */
function ifMatch(version: number): string {
  return `"${version}"`;
}

/** Reads the current version from response headers, if present. */
function readVersionHeader(headers: Readonly<Record<string, string>>): number | undefined {
  const raw = headers['etag'] ?? headers['x-resource-version'];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw.replace(/"/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalizes a thrown transport error into a stable `ApiError` /
 * `ApiConflictError`. Never inspects or logs the request/response body.
 */
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : 0;

  const serverCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : undefined;

  const currentVersion =
    typeof err === 'object' && err !== null && 'currentVersion' in err
      ? Number((err as { currentVersion: unknown }).currentVersion)
      : undefined;

  if (status === 409 || status === 412) {
    return new ApiConflictError(
      status,
      'This item was changed by someone else. Reload to see the latest version.',
      Number.isFinite(currentVersion) ? currentVersion : undefined,
    );
  }

  const code: ApiErrorCode =
    status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 422
            ? 'validation_failed'
            : status === 429
              ? 'rate_limited'
              : status >= 500
                ? 'server_error'
                : status === 0
                  ? 'network_error'
                  : (serverCode as ApiErrorCode | undefined) ?? 'unknown';

  const message =
    code === 'unauthorized'
      ? 'Your session has expired. Sign in again to continue.'
      : code === 'forbidden'
        ? 'You do not have permission to perform this action.'
        : code === 'not_found'
          ? 'The requested item could not be found.'
          : code === 'validation_failed'
            ? 'Some fields need attention before this can be saved.'
            : code === 'rate_limited'
              ? 'Too many requests. Please wait a moment and try again.'
              : code === 'network_error'
                ? 'Network error. Check your connection and try again.'
                : code === 'server_error'
                  ? 'Something went wrong on our side. Please try again.'
                  : 'The request could not be completed.';

  return new ApiError(code, status, message);
}

/** Executes a request and normalizes failures into stable errors. */
async function call<T>(client: ApiClient, req: ApiRequest): Promise<ApiResponse<T>> {
  try {
    return await client.request<T>(req);
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------------------------------------------------------------------
// CAPSTONE-066 — Collaborative project notes
// ---------------------------------------------------------------------------

export type NoteVisibility = 'project' | 'members' | 'private';

export interface NoteLink {
  readonly kind: 'note' | 'task' | 'milestone' | 'external';
  readonly targetId: string;
  readonly label?: string;
}

export interface ProjectNote {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly /** Sanitized, safe-to-render body. Server is responsible for sanitization. */
  body: string;
  readonly visibility: NoteVisibility;
  readonly tags: readonly string[];
  readonly links: readonly NoteLink[];
  readonly archived: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface NoteRevision {
  readonly noteId: string;
  readonly version: number;
  readonly title: string;
  readonly body: string;
  readonly editedAt: string;
  readonly editedBy: string;
}

export interface ListNotesParams extends TenantScope {
  readonly projectId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly tag?: string;
  readonly search?: string;
}

export interface CreateNoteInput extends TenantScope {
  readonly projectId: string;
  readonly title: string;
  readonly body: string;
  readonly visibility: NoteVisibility;
  readonly tags?: readonly string[];
  readonly links?: readonly NoteLink[];
}

export interface UpdateNoteInput extends TenantScope {
  readonly projectId: string;
  readonly noteId: string;
  /** Required for optimistic concurrency; stale values raise ApiConflictError. */
  readonly expectedVersion: number;
  readonly title?: string;
  readonly body?: string;
  readonly visibility?: NoteVisibility;
  readonly tags?: readonly string[];
  readonly links?: readonly NoteLink[];
}

export interface ArchiveNoteInput extends TenantScope {
  readonly projectId: string;
  readonly noteId: string;
  readonly expectedVersion: number;
  readonly archived: boolean;
}

export interface NotesService {
  list(params: ListNotesParams, options?: RequestOptions): Promise<CursorPage<ProjectNote>>;
  get(
    params: TenantScope & { projectId: string; noteId: string },
    options?: RequestOptions,
  ): Promise<ProjectNote>;
  revisions(
    params: TenantScope & { projectId: string; noteId: string },
    options?: RequestOptions,
  ): Promise<readonly NoteRevision[]>;
  create(input: CreateNoteInput, options?: RequestOptions): Promise<ProjectNote>;
  update(input: UpdateNoteInput, options?: RequestOptions): Promise<ProjectNote>;
  archive(input: ArchiveNoteInput, options?: RequestOptions): Promise<ProjectNote>;
}

export function createNotesService(client: ApiClient): NotesService {
  const base = (projectId: string) => `/v2/projects/${encodeURIComponent(projectId)}/notes`;

  return {
    async list(params, options) {
      const res = await call<CursorPage<ProjectNote>>(client, {
        method: 'GET',
        path: base(params.projectId),
        query: {
          tenantId: params.tenantId,
          cursor: params.cursor,
          limit: params.limit,
          includeArchived: params.includeArchived,
          tag: params.tag,
          search: params.search,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async get(params, options) {
      const res = await call<ProjectNote>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/${encodeURIComponent(params.noteId)}`,
        query: { tenantId: params.tenantId },
        signal: options?.signal,
      });
      return res.data;
    },

    async revisions(params, options) {
      const res = await call<readonly NoteRevision[]>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/${encodeURIComponent(params.noteId)}/revisions`,
        query: { tenantId: params.tenantId },
        signal: options?.signal,
      });
      return res.data;
    },

    async create(input, options) {
      const res = await call<ProjectNote>(client, {
        method: 'POST',
        path: base(input.projectId),
        query: { tenantId: input.tenantId },
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: {
          title: input.title,
          body: input.body,
          visibility: input.visibility,
          tags: input.tags ?? [],
          links: input.links ?? [],
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async update(input, options) {
      const res = await call<ProjectNote>(client, {
        method: 'PATCH',
        path: `${base(input.projectId)}/${encodeURIComponent(input.noteId)}`,
        query: { tenantId: input.tenantId },
        headers: {
          'Idempotency-Key': createIdempotencyKey(),
          'If-Match': ifMatch(input.expectedVersion),
        },
        body: {
          title: input.title,
          body: input.body,
          visibility: input.visibility,
          tags: input.tags,
          links: input.links,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async archive(input, options) {
      const res = await call<ProjectNote>(client, {
        method: 'PATCH',
        path: `${base(input.projectId)}/${encodeURIComponent(input.noteId)}/archive`,
        query: { tenantId: input.tenantId },
        headers: {
          'Idempotency-Key': createIdempotencyKey(),
          'If-Match': ifMatch(input.expectedVersion),
        },
        body: { archived: input.archived },
        signal: options?.signal,
      });
      return res.data;
    },
  };
}

// ---------------------------------------------------------------------------
// CAPSTONE-072 — Project activity feed
// ---------------------------------------------------------------------------

export type ActivityType =
  | 'note.created'
  | 'note.updated'
  | 'note.archived'
  | 'rubric.published'
  | 'review.submitted'
  | 'member.joined'
  | 'milestone.completed'
  | 'other';

export interface ActivityItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: ActivityType;
  /** Actor display name; may be redacted to "A reviewer" under blinding. */
  readonly actor: string;
  /** ISO timestamp. */
  readonly occurredAt: string;
  /** Safe, permission-filtered summary. Never contains private content. */
  readonly summary: string;
  /** Deep link into the relevant workspace surface. */
  readonly deepLink: string;
  readonly read: boolean;
  /** Retention bucket; items past retention are excluded server-side. */
  readonly retentionClass: 'standard' | 'extended';
}

export interface ListActivityParams extends TenantScope {
  readonly projectId: string;
  readonly cursor?: string;
  readonly limit?: number;
  /** Restrict to specific activity types (permission-filtered server-side). */
  readonly types?: readonly ActivityType[];
  /** Only return items at or after this ISO timestamp. */
  readonly since?: string;
  /** Only return unread items. */
  readonly unreadOnly?: boolean;
}

export interface MarkReadInput extends TenantScope {
  readonly projectId: string;
  readonly activityIds: readonly string[];
}

export interface ActivityService {
  list(params: ListActivityParams, options?: RequestOptions): Promise<CursorPage<ActivityItem>>;
  markRead(input: MarkReadInput, options?: RequestOptions): Promise<{ updated: number }>;
  markAllRead(
    input: TenantScope & { projectId: string; upTo?: string },
    options?: RequestOptions,
  ): Promise<{ updated: number }>;
}

export function createActivityService(client: ApiClient): ActivityService {
  const base = (projectId: string) => `/v2/projects/${encodeURIComponent(projectId)}/activity`;

  return {
    async list(params, options) {
      const res = await call<CursorPage<ActivityItem>>(client, {
        method: 'GET',
        path: base(params.projectId),
        query: {
          tenantId: params.tenantId,
          cursor: params.cursor,
          limit: params.limit,
          types: params.types && params.types.length > 0 ? params.types.join(',') : undefined,
          since: params.since,
          unreadOnly: params.unreadOnly,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async markRead(input, options) {
      const res = await call<{ updated: number }>(client, {
        method: 'POST',
        path: `${base(input.projectId)}/read`,
        query: { tenantId: input.tenantId },
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: { activityIds: input.activityIds },
        signal: options?.signal,
      });
      return res.data;
    },

    async markAllRead(input, options) {
      const res = await call<{ updated: number }>(client, {
        method: 'POST',
        path: `${base(input.projectId)}/read-all`,
        query: { tenantId: input.tenantId },
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: { upTo: input.upTo },
        signal: options?.signal,
      });
      return res.data;
    },
  };
}

// ---------------------------------------------------------------------------
// CAPSTONE-074 — Configurable review rubrics
// ---------------------------------------------------------------------------

export type RubricVisibility = 'reviewers' | 'participants' | 'public';
export type RubricAggregation = 'weighted_mean' | 'mean' | 'median' | 'sum';

export interface RubricCriterion {
  readonly id: string;
  readonly label: string;
  readonly guidance: string;
  /** Inclusive score bounds. */
  readonly minScore: number;
  readonly maxScore: number;
  /** Relative weight; normalized across criteria at aggregation time. */
  readonly weight: number;
  /** When true, a comment is mandatory for any non-max score. */
  readonly requiredComment: boolean;
}

export interface Rubric {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly version: number;
  readonly status: 'draft' | 'published' | 'archived';
  readonly criteria: readonly RubricCriterion[];
  readonly visibility: RubricVisibility;
  readonly aggregation: RubricAggregation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
}

export interface ListRubricsParams extends TenantScope {
  readonly projectId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: Rubric['status'];
}

export interface CreateRubricInput extends TenantScope {
  readonly projectId: string;
  readonly title: string;
  readonly criteria: readonly RubricCriterion[];
  readonly visibility: RubricVisibility;
  readonly aggregation: RubricAggregation;
}

export interface UpdateRubricInput extends TenantScope {
  readonly projectId: string;
  readonly rubricId: string;
  readonly expectedVersion: number;
  readonly title?: string;
  readonly criteria?: readonly RubricCriterion[];
  readonly visibility?: RubricVisibility;
  readonly aggregation?: RubricAggregation;
}

export interface PublishRubricInput extends TenantScope {
  readonly projectId: string;
  readonly rubricId: string;
  readonly expectedVersion: number;
}

export interface RubricService {
  list(params: ListRubricsParams, options?: RequestOptions): Promise<CursorPage<Rubric>>;
  get(
    params: TenantScope & { projectId: string; rubricId: string },
    options?: RequestOptions,
  ): Promise<Rubric>;
  create(input: CreateRubricInput, options?: RequestOptions): Promise<Rubric>;
  update(input: UpdateRubricInput, options?: RequestOptions): Promise<Rubric>;
  publish(input: PublishRubricInput, options?: RequestOptions): Promise<Rubric>;
}

export function createRubricService(client: ApiClient): RubricService {
  const base = (projectId: string) => `/v2/projects/${encodeURIComponent(projectId)}/rubrics`;

  return {
    async list(params, options) {
      const res = await call<CursorPage<Rubric>>(client, {
        method: 'GET',
        path: base(params.projectId),
        query: {
          tenantId: params.tenantId,
          cursor: params.cursor,
          limit: params.limit,
          status: params.status,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async get(params, options) {
      const res = await call<Rubric>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/${encodeURIComponent(params.rubricId)}`,
        query: { tenantId: params.tenantId },
        signal: options?.signal,
      });
      return res.data;
    },

    async create(input, options) {
      const res = await call<Rubric>(client, {
        method: 'POST',
        path: base(input.projectId),
        query: { tenantId: input.tenantId },
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: {
          title: input.title,
          criteria: input.criteria,
          visibility: input.visibility,
          aggregation: input.aggregation,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async update(input, options) {
      const res = await call<Rubric>(client, {
        method: 'PATCH',
        path: `${base(input.projectId)}/${encodeURIComponent(input.rubricId)}`,
        query: { tenantId: input.tenantId },
        headers: {
          'Idempotency-Key': createIdempotencyKey(),
          'If-Match': ifMatch(input.expectedVersion),
        },
        body: {
          title: input.title,
          criteria: input.criteria,
          visibility: input.visibility,
          aggregation: input.aggregation,
        },
        signal: options?.signal,
      });
      return res.data;
    },

    async publish(input, options) {
      const res = await call<Rubric>(client, {
        method: 'POST',
        path: `${base(input.projectId)}/${encodeURIComponent(input.rubricId)}/publish`,
        query: { tenantId: input.tenantId },
        headers: {
          'Idempotency-Key': createIdempotencyKey(),
          'If-Match': ifMatch(input.expectedVersion),
        },
        signal: options?.signal,
      });
      return res.data;
    },
  };
}

// ---------------------------------------------------------------------------
// CAPSTONE-076 — Blinded review modes
// ---------------------------------------------------------------------------

export type BlindMode = 'none' | 'single_blind' | 'double_blind';

export interface BlindingConfig {
  readonly projectId: string;
  readonly mode: BlindMode;
  /** Identity fields to strip from projections (e.g. 'reviewerName'). */
  readonly hiddenFields: readonly string[];
  /** Whether blinding applies to exports in addition to on-screen queues. */
  readonly applyToExports: boolean;
}

export interface BlindedReviewQueueItem {
  readonly id: string;
  readonly projectId: string;
  readonly submissionId: string;
  readonly status: 'pending' | 'in_review' | 'completed';
  readonly assignedAt: string;
  /** Present only when blinding permits; otherwise omitted server-side. */
  readonly reviewerName?: string;
  readonly participantName?: string;
  readonly rubricId: string;
}

export interface BlindedReviewExportRow {
  readonly submissionId: string;
  readonly rubricId: string;
  readonly score: number;
  readonly comment?: string;
  /** Present only when blinding permits. */
  readonly reviewerName?: string;
  readonly participantName?: string;
}

export interface BlindedReviewService {
  getConfig(
    params: TenantScope & { projectId: string },
    options?: RequestOptions,
  ): Promise<BlindingConfig>;
  listQueue(
    params: TenantScope & { projectId: string; cursor?: string; limit?: number },
    options?: RequestOptions,
  ): Promise<CursorPage<BlindedReviewQueueItem>>;
  exportProjection(
    params: TenantScope & { projectId: string; rubricId?: string },
    options?: RequestOptions,
  ): Promise<readonly BlindedReviewExportRow[]>;
}

/**
 * Defense-in-depth: strips configured identity fields from a projection even
 * if the server accidentally includes them. Returns a shallow copy so callers
 * never mutate the original response.
 */
function stripHiddenFields<T extends Record<string, unknown>>(
  row: T,
  hiddenFields: readonly string[],
): T {
  if (hiddenFields.length === 0) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const field of hiddenFields) {
    delete copy[field];
  }
  return copy as T;
}

export function createBlindedReviewService(client: ApiClient): BlindedReviewService {
  const base = (projectId: string) => `/v2/projects/${encodeURIComponent(projectId)}/reviews`;

  return {
    async getConfig(params, options) {
      const res = await call<BlindingConfig>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/blinding`,
        query: { tenantId: params.tenantId },
        signal: options?.signal,
      });
      return res.data;
    },

    async listQueue(params, options) {
      const res = await call<CursorPage<BlindedReviewQueueItem>>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/queue`,
        query: {
          tenantId: params.tenantId,
          cursor: params.cursor,
          limit: params.limit,
        },
        signal: options?.signal,
      });

      // Fetch config to know which fields to strip. If config fetch fails we
      // fail closed by stripping the known identity fields.
      let hiddenFields: readonly string[] = ['reviewerName', 'participantName'];
      try {
        const config = await this.getConfig(
          { tenantId: params.tenantId, projectId: params.projectId },
          options,
        );
        if (config.mode !== 'none') {
          hiddenFields = config.hiddenFields.length > 0 ? config.hiddenFields : hiddenFields;
        } else {
          hiddenFields = [];
        }
      } catch {
        // Fail closed: keep default hidden fields.
      }

      return {
        ...res.data,
        items: res.data.items.map((item) =>
          stripHiddenFields(item as unknown as Record<string, unknown>, hiddenFields) as unknown as BlindedReviewQueueItem,
        ),
      };
    },

    async exportProjection(params, options) {
      const res = await call<readonly BlindedReviewExportRow[]>(client, {
        method: 'GET',
        path: `${base(params.projectId)}/export`,
        query: { tenantId: params.tenantId, rubricId: params.rubricId },
        signal: options?.signal,
      });

      let hiddenFields: readonly string[] = ['reviewerName', 'participantName'];
      try {
        const config = await this.getConfig(
          { tenantId: params.tenantId, projectId: params.projectId },
          options,
        );
        if (config.mode !== 'none' && config.applyToExports) {
          hiddenFields = config.hiddenFields.length > 0 ? config.hiddenFields : hiddenFields;
        } else {
          hiddenFields = [];
        }
      } catch {
        // Fail closed.
      }

      return res.data.map(
        (row) =>
          stripHiddenFields(
            row as unknown as Record<string, unknown>,
            hiddenFields,
          ) as unknown as BlindedReviewExportRow,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Aggregate workspace service bundle
// ---------------------------------------------------------------------------

export interface WorkspaceServices {
  readonly notes: NotesService;
  readonly activity: ActivityService;
  readonly rubrics: RubricService;
  readonly blindedReviews: BlindedReviewService;
}

/**
 * Builds the full set of workspace services from a shared `ApiClient`.
 * Consumers should memoize this per client instance.
 */
export function createWorkspaceServices(client: ApiClient): WorkspaceServices {
  return {
    notes: createNotesService(client),
    activity: createActivityService(client),
    rubrics: createRubricService(client),
    blindedReviews: createBlindedReviewService(client),
  };
}