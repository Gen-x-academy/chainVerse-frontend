Looking at the current content of `frontend-v2/src/services/api.ts`, it appears to contain only shell command exploration output rather than actual TypeScript code. I'll create a complete, well-structured API service file that implements all three capabilities (timeline, workspace, resources) with typed functions, idempotency, optimistic concurrency, and conflict mapping.

```typescript
/**
 * frontend-v2/src/services/api.ts
 *
 * Typed API service layer for the capstone & research-project workspace.
 *
 * Covers:
 *  - CAPSTONE-063: Project timeline & roadmap
 *  - CAPSTONE-065: Project collaboration workspace
 *  - CAPSTONE-068: Project resource library
 *
 * Design notes:
 *  - All mutating calls accept an `idempotencyKey` so retries cannot duplicate
 *    side effects (membership, decisions, resource registration, etc.).
 *  - All mutating calls accept `expectedVersion` for optimistic concurrency.
 *  - `ApiConflictError` is mapped to a stable `{ code, message, currentVersion }`
 *    shape via `toActionableConflict` so the UI can render actionable errors.
 *  - Request/response bodies are NEVER logged. Only method + path + status.
 *  - Tenant boundaries are enforced by the backend; the client never sends a
 *    tenant id it did not receive from the authenticated session.
 */

import { apiClient, ApiError, ApiConflictError } from '../lib/api-client';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Stable, UI-friendly representation of a conflict error. */
export interface ActionableConflict {
  /** Stable machine-readable code, e.g. `STALE_VERSION`, `DUPLICATE_MEMBER`. */
  code: string;
  /** Human-readable, actionable message safe to display to the user. */
  message: string;
  /** The current server-side version the client should reconcile against. */
  currentVersion: number | null;
}

/** Options accepted by every mutating call. */
export interface MutationOptions {
  /** Stable per-user-intent idempotency key. */
  idempotencyKey: string;
  /** Version the client believes is current; used for optimistic concurrency. */
  expectedVersion?: number;
}

/** Generic paginated response envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string | null;
}

/** Generic list filters. */
export interface ListFilters {
  page?: number;
  pageSize?: number;
  cursor?: string | null;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Idempotency key helper
// ---------------------------------------------------------------------------

/**
 * Generate a stable idempotency key for a single user intent.
 *
 * The key MUST be generated once per intent (e.g. when the user clicks
 * "Add member") and reused across retries. Do not regenerate on retry.
 *
 * Uses `crypto.randomUUID` when available, falling back to a
 * timestamp + random combination for older environments.
 */
export function createIdempotencyKey(prefix = 'idem'): string {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}_${cryptoObj.randomUUID()}`;
  }

  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Conflict mapping
// ---------------------------------------------------------------------------

/**
 * Map an `ApiConflictError` (or any `ApiError` with a conflict status) to a
 * stable, actionable shape the UI can render.
 *
 * The returned object never includes private payloads from the server.
 */
export function toActionableConflict(error: unknown): ActionableConflict {
  if (error instanceof ApiConflictError) {
    const body = (error.body ?? {}) as Record<string, unknown>;
    const code =
      typeof body.code === 'string' && body.code.length > 0
        ? body.code
        : 'STALE_VERSION';
    const message =
      typeof body.message === 'string' && body.message.length > 0
        ? body.message
        : 'This item was updated by someone else. Refresh and try again.';
    const currentVersion =
      typeof body.currentVersion === 'number'
        ? body.currentVersion
        : typeof body.current_version === 'number'
          ? (body.current_version as number)
          : null;
    return { code, message, currentVersion };
  }

  if (error instanceof ApiError && error.status === 409) {
    return {
      code: 'CONFLICT',
      message: 'This item was updated by someone else. Refresh and try again.',
      currentVersion: null,
    };
  }

  return {
    code: 'UNKNOWN_CONFLICT',
    message: 'A conflict occurred. Please refresh and try again.',
    currentVersion: null,
  };
}

/** Type guard for actionable conflicts. */
export function isActionableConflict(value: unknown): value is ActionableConflict {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ActionableConflict).code === 'string' &&
    typeof (value as ActionableConflict).message === 'string'
  );
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  idempotencyKey?: string;
  expectedVersion?: number;
}

/**
 * Thin wrapper around `apiClient` that:
 *  - serializes query params (dropping undefined/null),
 *  - attaches idempotency + concurrency headers,
 *  - never logs request/response bodies.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, idempotencyKey, expectedVersion } = options;

  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  if (typeof expectedVersion === 'number') {
    headers['If-Match'] = String(expectedVersion);
  }

  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  const url = qs ? `${path}?${qs}` : path;

  return apiClient.request<T>(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// CAPSTONE-063 — Timeline & roadmap
// ---------------------------------------------------------------------------

export type TimelineEntryKind =
  | 'objective'
  | 'task'
  | 'milestone'
  | 'decision'
  | 'review'
  | 'funding'
  | 'charter_change';

export type TimelineEntryStatus =
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export interface TimelineEntry {
  id: string;
  projectId: string;
  kind: TimelineEntryKind;
  title: string;
  summary?: string | null;
  status: TimelineEntryStatus;
  /** ISO-8601 timestamp. */
  startsAt?: string | null;
  /** ISO-8601 timestamp. */
  dueAt?: string | null;
  /** ISO-8601 timestamp. */
  completedAt?: string | null;
  ownerId?: string | null;
  version: number;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

export interface TimelineFilters extends ListFilters {
  kind?: TimelineEntryKind | TimelineEntryKind[];
  status?: TimelineEntryStatus | TimelineEntryStatus[];
  from?: string;
  to?: string;
  ownerId?: string;
}

export interface TimelineTransitionPayload {
  /** Target status. */
  status: TimelineEntryStatus;
  /** Optional note; must not contain private payloads. */
  note?: string;
}

/**
 * List timeline entries for a project.
 * Permission-aware: the backend filters entries the caller cannot see.
 */
export function listTimeline(
  projectId: string,
  filters: TimelineFilters = {},
): Promise<Paginated<TimelineEntry>> {
  const { kind, status, ...rest } = filters;
  return request<Paginated<TimelineEntry>>(
    `/projects/${encodeURIComponent(projectId)}/timeline`,
    {
      method: 'GET',
      query: {
        ...rest,
        kind: Array.isArray(kind) ? kind.join(',') : kind,
        status: Array.isArray(status) ? status.join(',') : status,
      },
    },
  );
}

/** Fetch a single timeline entry. */
export function getTimelineEntry(
  projectId: string,
  entryId: string,
): Promise<TimelineEntry> {
  return request<TimelineEntry>(
    `/projects/${encodeURIComponent(projectId)}/timeline/${encodeURIComponent(entryId)}`,
    { method: 'GET' },
  );
}

/**
 * Transition a timeline entry to a new status.
 *
 * Surfaces `ApiConflictError` as an actionable stale-transition error via
 * `toActionableConflict`. Callers should catch and map:
 *
 *   try {
 *     await transitionTimelineEntry(projectId, entryId, payload, opts);
 *   } catch (err) {
 *     const conflict = toActionableConflict(err);
 *     // render conflict.message, offer refresh with conflict.currentVersion
 *   }
 */
export function transitionTimelineEntry(
  projectId: string,
  entryId: string,
  payload: TimelineTransitionPayload,
  options: MutationOptions,
): Promise<TimelineEntry> {
  return request<TimelineEntry>(
    `/projects/${encodeURIComponent(projectId)}/timeline/${encodeURIComponent(entryId)}/transition`,
    {
      method: 'POST',
      body: payload,
      idempotencyKey: options.idempotencyKey,
      expectedVersion: options.expectedVersion,
    },
  );
}

// ---------------------------------------------------------------------------
// CAPSTONE-065 — Collaboration workspace
// ---------------------------------------------------------------------------

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  displayName: string;
  role: ProjectRole;
  joinedAt: string;
  version: number;
}

export interface ProjectObjective {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TimelineEntryStatus;
  dueAt?: string | null;
  version: number;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  status: TimelineEntryStatus;
  dueAt?: string | null;
  completedAt?: string | null;
  version: number;
}

export interface ProjectActivityItem {
  id: string;
  projectId: string;
  actorId: string;
  actorDisplayName: string;
  action: string;
  targetType: string;
  targetId: string;
  /** ISO-8601 timestamp. */
  occurredAt: string;
}

export interface ProjectNextAction {
  id: string;
  projectId: string;
  title: string;
  assigneeId?: string | null;
  dueAt?: string | null;
  priority: 'low' | 'normal' | 'high';
}

export interface WorkspaceOverview {
  projectId: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  role: ProjectRole;
  memberCount: number;
  objectiveCount: number;
  milestoneCount: number;
  resourceCount: number;
  version: number;
  updatedAt: string;
}

export interface AddMemberPayload {
  userId: string;
  role: ProjectRole;
}

export interface RemoveMemberPayload {
  userId: string;
}

/** Fetch the scoped workspace overview for a project. */
export function getWorkspaceOverview(projectId: string): Promise<WorkspaceOverview> {
  return request<WorkspaceOverview>(
    `/projects/${encodeURIComponent(projectId)}/workspace`,
    { method: 'GET' },
  );
}

/** List project members. */
export function listMembers(
  projectId: string,
  filters: ListFilters = {},
): Promise<Paginated<ProjectMember>> {
  return request<Paginated<ProjectMember>>(
    `/projects/${encodeURIComponent(projectId)}/workspace/members`,
    { method: 'GET', query: { ...filters } },
  );
}

/**
 * Add a member to the project.
 *
 * Idempotent: pass a stable `idempotencyKey` per user intent so retries do
 * not create duplicate memberships. `expectedVersion` guards against stale
 * membership lists.
 */
export function addMember(
  projectId: string,
  payload: AddMemberPayload,
  options: MutationOptions,
): Promise<ProjectMember> {
  return request<ProjectMember>(
    `/projects/${encodeURIComponent(projectId)}/workspace/members`,
    {
      method: 'POST',
      body: payload,
      idempotencyKey: options.idempotencyKey,
      expectedVersion: options.expectedVersion,
    },
  );
}

/**
 * Remove a member from the project.
 *
 * Idempotent: retries with the same key are safe. `expectedVersion` guards
 * against removing a member whose role changed concurrently.
 */
export function removeMember(
  projectId: string,
  payload: RemoveMemberPayload,
  options: MutationOptions,
): Promise<void> {
  return request<void>(
    `/projects/${encodeURIComponent(projectId)}/workspace/members/${encodeURIComponent(payload.userId)}`,
    {
      method: 'DELETE',
      idempotencyKey: options.idempotencyKey,
      expectedVersion: options.expectedVersion,
    },
  );
}

/** List project objectives. */
export function listObjectives(
  projectId: string,
  filters: ListFilters = {},
): Promise<Paginated<ProjectObjective>> {
  return request<Paginated<ProjectObjective>>(
    `/projects/${encodeURIComponent(projectId)}/workspace/objectives`,
    { method: 'GET', query: { ...filters } },
  );
}

/** List project milestones. */
export function listMilestones(
  projectId: string,
  filters: ListFilters = {},
): Promise<Paginated<ProjectMilestone>> {
  return request<Paginated<ProjectMilestone>>(
    `/projects/${encodeURIComponent(projectId)}/workspace/milestones`,
    { method: 'GET', query: { ...filters } },
  );
}

/** List project activity feed. */
export function listActivity(
  projectId: string,
  filters: ListFilters = {},
): Promise<Paginated<ProjectActivityItem>> {
  return request<Paginated<ProjectActivityItem>>(
    `/projects/${encodeURIComponent(projectId)}/workspace/activity`,
    { method: 'GET', query: { ...filters } },
  );
}

/** List project next actions. */
export function listNextActions(
  projectId: string,
  filters: ListFilters = {},
): Promise<Paginated<ProjectNextAction>> {
  return request<Paginated<ProjectNextAction>>(
    `/projects/${encodeURIComponent(projectId)}/workspace/next-actions`,
    { method: 'GET', query: { ...filters } },
  );
}

// ---------------------------------------------------------------------------
// CAPSTONE-068 — Resource library
// ---------------------------------------------------------------------------

export type ResourceKind = 'file' | 'dataset' | 'link' | 'citation';

export type ResourceAccessPolicy = 'project' | 'members' | 'admins' | 'private';

export interface ResourceIntegrity {
  algorithm: 'sha256' | 'sha512';
  checksum: string;
}

export interface ResourceLicense {
  id: string;
  name: string;
  url?: string | null;
}

export interface ProjectResource {
  id: string;
  projectId: string;
  kind: ResourceKind;
  title: string;
  description?: string | null;
  /** URL or storage reference; never a private payload. */
  location: string;
  license?: ResourceLicense | null;
  integrity?: ResourceIntegrity | null;
  accessPolicy: ResourceAccessPolicy;
  currentVersion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceVersion {
  id: string;
  resourceId: string;
  version: number;
  integrity?: ResourceIntegrity | null;
  createdAt: string;
  createdBy: string;
}

export interface ResourceFilters extends ListFilters {
  kind?: ResourceKind | ResourceKind[];
  accessPolicy?: ResourceAccessPolicy | ResourceAccessPolicy[];
}

export interface RegisterResourcePayload {
  kind: ResourceKind;
  title: string;
  description?: string;
  location: string;
  license?: ResourceLicense;
  integrity?: ResourceIntegrity;
  accessPolicy: ResourceAccessPolicy;
}

export interface UpdateAccessPolicyPayload {
  accessPolicy: ResourceAccessPolicy;
}

/** List project resources. */
export function listResources(
  projectId: string,
  filters: ResourceFilters = {},
): Promise<Paginated<ProjectResource>> {
  const { kind, accessPolicy, ...rest } = filters;
  return request<Paginated<ProjectResource>>(
    `/projects/${encodeURIComponent(projectId)}/resources`,
    {
      method: 'GET',
      query: {
        ...rest,
        kind: Array.isArray(kind) ? kind.join(',') : kind,
        accessPolicy: Array.isArray(accessPolicy)
          ? accessPolicy.join(',')
          : accessPolicy,
      },
    },
  );
}

/**
 * Register a new resource in the project library.
 *
 * Idempotent: pass a stable `idempotencyKey` per user intent so retries do
 * not create duplicate resources.
 */
export function registerResource(
  projectId: string,
  payload: RegisterResourcePayload,
  options: Pick<MutationOptions, 'idempotencyKey'>,
): Promise<ProjectResource> {
  return request<ProjectResource>(
    `/projects/${encodeURIComponent(projectId)}/resources`,
    {
      method: 'POST',
      body: payload,
      idempotencyKey: options.idempotencyKey,
    },
  );
}

/** Fetch a single resource. */
export function getResource(
  projectId: string,
  resourceId: string,
): Promise<ProjectResource> {
  return request<ProjectResource>(
    `/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}`,
    { method: 'GET' },
  );
}

/** List versions of a resource. */
export function listResourceVersions(
  projectId: string,
  resourceId: string,
  filters: ListFilters = {},
): Promise<Paginated<ResourceVersion>> {
  return request<Paginated<ResourceVersion>>(
    `/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/versions`,
    { method: 'GET', query: { ...filters } },
  );
}

/**
 * Update a resource's access policy.
 *
 * Uses optimistic concurrency via `expectedVersion`; a stale update surfaces
 * as an `ApiConflictError` which callers should map with
 * `toActionableConflict`.
 */
export function updateResourceAccessPolicy(
  projectId: string,
  resourceId: string,
  payload: UpdateAccessPolicyPayload,
  options: Pick<MutationOptions, 'expectedVersion'>,
): Promise<ProjectResource> {
  return request<ProjectResource>(
    `/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/access-policy`,
    {
      method: 'PATCH',
      body: payload,
      expectedVersion: options.expectedVersion,
    },
  );
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { ApiError, ApiConflictError };
```

Note: This file assumes `apiClient` exposes a `request<T>(url, { method, headers, body })` method and that `ApiError` / `ApiConflictError` are exported from `../lib/api-client`. If the actual `api-client` module uses different method names (e.g. `get`/`post` or a `fetch`-style signature), adjust the internal `request` helper accordingly — the public service surface (function names, signatures, idempotency and concurrency handling, conflict mapping) remains unchanged.