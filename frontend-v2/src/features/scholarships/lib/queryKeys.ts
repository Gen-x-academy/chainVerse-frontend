/**
 * Central scholarship query-key factory (issue #1227).
 *
 * Before this module the feature owned ten independent key factories with ten
 * unrelated roots (`scholarships`, `application-drafts`, `sponsor-team`, ...).
 * Two problems followed from that:
 *
 * 1. **Cross-feature fan-out was impossible.** An award decision changes the
 *    award, the application's status, the round's remaining capacity, the
 *    budget reservation and the disbursement schedule, but those live under
 *    different roots, so no single `invalidateQueries` call can reach them and
 *    every view kept rendering stale data until a manual reload.
 * 2. **Nothing was identity-scoped.** Keys were global, so a cache entry
 *    written for one signed-in user could be read by the next user in the same
 *    tab. `lib/clear-user-query-cache.ts` could not help either: it was never
 *    wired into logout, and none of these roots were on its allow-list.
 *
 * Every scholarship key now hangs off one root, scoped to the authenticated
 * identity, and every namespace exposes a `lists()` prefix so invalidating a
 * collection refreshes all of its filter variants at once.
 *
 * Keys must never contain a secret. Invitation tokens used to be a key segment
 * (`sponsorTeamQueryKeys.validateToken(token)`), which put a live bearer
 * credential in the query cache and in React Query DevTools. Use
 * `sponsorTeam.validateInvitation()` — a constant key — and pass the token to
 * the query function instead.
 */

import type { ScholarshipApplicationListParams } from '../types/scholarship.types';

/** Root segment for every scholarship query. Kept in sync with the logout allow-list. */
export const SCHOLARSHIP_QUERY_ROOT = 'scholarships';

/**
 * The identity a cached scholarship response is allowed to be shown to.
 *
 * `tenantId` is optional because not every session carries one; when absent it
 * collapses to `self`, which still isolates a user from every other user. The
 * API remains authoritative for tenancy (ADR-001) — this only stops the browser
 * from displaying one tenant's cached rows under another tenant's session.
 */
export type ScholarshipIdentity = {
  userId: string;
  role: string;
  tenantId?: string;
};

/** Cache scope used before sign-in, and whenever the principal is unknown. */
export const ANONYMOUS_SCHOLARSHIP_IDENTITY: ScholarshipIdentity = {
  userId: 'anonymous',
  role: 'anonymous',
};

/**
 * A filter object. Deliberately `object` rather than `Record<string, unknown>`:
 * a named `interface` is not assignable to an index-signature type, and the
 * domain query params (`WindowQueryParams`, `ScopeQueryParams`, …) are all
 * interfaces.
 */
export type ScholarshipFilter = object;

export type ScholarshipQueryKey = readonly unknown[];

/**
 * Canonicalises a filter object so that two logically identical filters always
 * produce the same key.
 *
 * React Query hashes keys with an order-sensitive JSON serialisation, so
 * `{ page: 1, status: 'x' }` and `{ status: 'x', page: 1 }` are two separate
 * cache entries for one query. Dropping `undefined` matters for the same
 * reason: `{ page: undefined }` must not be distinct from `{}`.
 */
export function normalizeScholarshipFilter(
  filter?: ScholarshipFilter,
): Record<string, unknown> {
  if (!filter) return {};
  const source = filter as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    if (value === undefined) continue;
    normalized[key] = value;
  }
  return normalized;
}

export interface QueryKeyNamespace {
  /** Prefix for the whole namespace. */
  all: ScholarshipQueryKey;
  /** Prefix covering every filter variant of the collection. */
  lists: () => ScholarshipQueryKey;
  /** One filter variant of the collection. */
  list: (filter?: ScholarshipFilter) => ScholarshipQueryKey;
  /** One record. */
  detail: (id: string) => ScholarshipQueryKey;
  /** Escape hatch for shapes that are neither a collection nor a record. */
  at: (...segments: unknown[]) => ScholarshipQueryKey;
  /**
   * A nested sub-collection, for a namespace that holds several independent
   * collections (for example sponsor-team members vs. invitations). Keeps their
   * `lists()` prefixes disjoint so invalidating one does not refetch the other.
   */
  group: (name: string) => QueryKeyNamespace;
}

function namespace(
  scopeKey: ScholarshipQueryKey,
  name: string,
): QueryKeyNamespace {
  const base = [...scopeKey, name] as const;
  const listRoot = [...base, 'list'] as const;
  return {
    all: base,
    lists: () => listRoot,
    list: (filter?: ScholarshipFilter) =>
      [...listRoot, normalizeScholarshipFilter(filter)] as const,
    detail: (id: string) => [...base, 'detail', id] as const,
    at: (...segments: unknown[]) => [...base, ...segments] as const,
    group: (groupName: string) => namespace(base, groupName),
  };
}

/**
 * Builds the full key set for one identity.
 *
 * Always obtained through `useScholarshipKeys()` (or `scholarshipQueryKeys()`
 * with an explicit identity) so a key can never be constructed unscoped.
 */
export function scholarshipQueryKeys(
  identity: ScholarshipIdentity = ANONYMOUS_SCHOLARSHIP_IDENTITY,
): ScholarshipQueryKeySet {
  const scopeKey = [
    SCHOLARSHIP_QUERY_ROOT,
    identity.tenantId ?? 'self',
    identity.role || ANONYMOUS_SCHOLARSHIP_IDENTITY.role,
    identity.userId || ANONYMOUS_SCHOLARSHIP_IDENTITY.userId,
  ] as const;

  return {
    /** Whole-feature root for this identity. Invalidating this clears every scholarship view. */
    all: scopeKey,

    programs: namespace(scopeKey, 'programs'),
    rounds: namespace(scopeKey, 'rounds'),
    applications: namespace(scopeKey, 'applications'),
    awards: namespace(scopeKey, 'awards'),
    agreements: namespace(scopeKey, 'agreements'),
    disbursements: namespace(scopeKey, 'disbursements'),
    schedules: namespace(scopeKey, 'schedules'),
    withdrawals: namespace(scopeKey, 'withdrawals'),
    payments: namespace(scopeKey, 'payments'),
    transactions: namespace(scopeKey, 'transactions'),
    budgets: namespace(scopeKey, 'budgets'),
    windows: namespace(scopeKey, 'windows'),
    drafts: namespace(scopeKey, 'drafts'),
    submissions: namespace(scopeKey, 'submissions'),
    formSchemas: namespace(scopeKey, 'form-schemas'),
    validation: namespace(scopeKey, 'validation'),
    duplicates: namespace(scopeKey, 'duplicates'),
    scopes: namespace(scopeKey, 'scopes'),
    milestones: namespace(scopeKey, 'milestones'),
    sponsorTeam: namespace(scopeKey, 'sponsor-team'),
    sponsorOrgs: namespace(scopeKey, 'sponsor-orgs'),
  };
}

export interface ScholarshipQueryKeySet {
  /** Whole-feature root for this identity. Invalidating this clears every view. */
  all: ScholarshipQueryKey;
  programs: QueryKeyNamespace;
  rounds: QueryKeyNamespace;
  applications: QueryKeyNamespace;
  awards: QueryKeyNamespace;
  agreements: QueryKeyNamespace;
  disbursements: QueryKeyNamespace;
  schedules: QueryKeyNamespace;
  withdrawals: QueryKeyNamespace;
  payments: QueryKeyNamespace;
  transactions: QueryKeyNamespace;
  budgets: QueryKeyNamespace;
  windows: QueryKeyNamespace;
  drafts: QueryKeyNamespace;
  submissions: QueryKeyNamespace;
  formSchemas: QueryKeyNamespace;
  validation: QueryKeyNamespace;
  duplicates: QueryKeyNamespace;
  scopes: QueryKeyNamespace;
  milestones: QueryKeyNamespace;
  sponsorTeam: QueryKeyNamespace;
  sponsorOrgs: QueryKeyNamespace;
}

/** Applications filtered by the query the API was asked for. */
export function scholarshipApplicationListKey(
  keys: ScholarshipQueryKeySet,
  params?: ScholarshipApplicationListParams,
): ScholarshipQueryKey {
  return keys.applications.list(params);
}
