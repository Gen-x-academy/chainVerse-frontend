# Scholarships query keys and cache invalidation

- Audience: operators
- Owner: Platform engineering
- Code owner: `@Gen-x-academy/chainVerse-frontend`
- Issue: #1227

## Overview

Every scholarship read goes through one query-key factory,
`src/features/scholarships/lib/queryKeys.ts`, and every scholarship write
declares which reads it invalidates in one table,
`src/features/scholarships/lib/invalidation.ts`.

The backend treats an award decision as a single transaction that also commits
a reservation, a ledger entry, an eligibility change and a disbursement
intent. The browser has to converge on all of those, but each is served by a
different query. Before this change, ten independent key roots existed, each
component invalidated only the keys it happened to know about, and a decision
left the applications, awards, disbursement, schedule and ledger views showing
pre-decision data until a manual reload.

### Key shape

```
['scholarships', <tenantId>, <role>, <userId>, <namespace>, ...]
```

For example:

```
['scholarships', 'tenant-a', 'student', 'user-1', 'awards', 'list']
['scholarships', 'tenant-a', 'student', 'user-1', 'awards', 'detail', 'award-9']
```

Each namespace exposes:

| Helper | Meaning |
| --- | --- |
| `all` | The namespace prefix. |
| `lists()` | Every filter variant of the collection. Invalidating this refetches all of them. |
| `list(filter)` | One filter variant. The filter is normalised, so key order and `undefined` values do not create duplicate entries. |
| `detail(id)` | One record. |
| `at(...segments)` | Anything else, such as `at('decisions', evidenceId)`. |
| `group(name)` | A nested sub-collection, for namespaces holding several independent collections. |

Namespaces: `programs`, `rounds`, `applications`, `awards`, `agreements`,
`disbursements`, `schedules`, `withdrawals`, `payments`, `transactions`,
`budgets`, `windows`, `drafts`, `submissions`, `formSchemas`, `validation`,
`duplicates`, `scopes`, `milestones`, `sponsorTeam`, `sponsorOrgs`.

### Invalidation rules

Two rules hold for every row of the matrix:

1. **Never guess an id.** A mutation that does not know an award id invalidates
   the award *collection*; one that does invalidates the specific `detail`.
   Guessing produces a key that matches nothing and a view that silently stays
   stale.
2. **Never widen to `all` unless the whole feature changed.** A full
   `keys.all` invalidation refetches every mounted query, so using it as a
   shortcut turns one decision into a burst of requests. No matrix row does.

`applyScholarshipInvalidation()` resolves a row to concrete keys, de-duplicates
them, and awaits every refetch, so a caller can navigate after the UI has
actually converged.

### Writing a new scholarship query

```ts
import { useScholarshipKeys } from '../lib/useScholarshipKeys';

export function useSomething(filters: SomethingFilters) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.<namespace>.list(filters),
    queryFn: () => service.something(filters),
  });
}
```

Never build a key by hand and never import `localStorage` to scope one. A hand
built key cannot be invalidated by the matrix, which is how the original drift
started.

### Adding a new scholarship mutation

1. Add a row to `SCHOLARSHIP_INVALIDATION_MATRIX` naming the views that move.
2. Call `applyScholarshipInvalidation` from the mutation's `onSuccess`.
3. Pass whatever ids the server returned. Each id you pass narrows the row from
   a collection refetch to a single-record refetch.
4. Add a test asserting the exact resolved key list.

## Ownership

| Surface | Owner |
| --- | --- |
| `lib/queryKeys.ts` (key shape, identity scope) | Platform engineering |
| `lib/invalidation.ts` (the matrix) | Platform engineering, reviewed by Finance for award and payment rows |
| `lib/clear-user-query-cache.ts` (teardown roots) | Platform engineering |
| `withdrawal/hooks.ts`, `disbursements/payments/hooks.ts`, `milestones/hooks.ts` | Feature owners, who own the matrix row for their mutation |

Adding a namespace is a platform change. Adding a mutation row is a feature
change, but it needs platform review if it widens a row to `all`.

## Privacy

The identity scope (`tenantId`, `role`, `userId`) is part of every key, so a
cached response can only ever be served to the principal it was fetched for.
Three rules protect that:

1. **Sign-out purges.** `clearUserScopedCache` runs on logout and on an identity
   switch, before the new identity is published. In-flight user-scoped queries
   are cancelled so a late response cannot repopulate the cache. Public
   catalogue data is deliberately retained; it is not sensitive and is expensive
   to refetch.
2. **No credential in a key.** Invitation validation used to place the raw
   bearer token in the query key, which parked a live credential in the cache
   and in React Query DevTools — readable by anything with devtools open, and
   sufficient on its own to accept the invitation as the invitee. The key now
   carries a short non-reversible digest that exists only to partition the
   cache. It is not a security primitive, must never be treated as a secret, and
   must never be logged. The verdict itself uses `staleTime: 0` and
   `gcTime: 0`, so it is dropped as soon as the view unmounts.
3. **No user data in a key.** Filters are values the API was asked for, not
   applicant content. Essays, evidence, and reviewer notes belong in the
   response body only. Adding a free-text applicant field to a key would write
   it to disk in the persisted query cache.

Withdrawal history is no longer written to an unscoped `localStorage` key. That
store was global, so a second person signing in on the same browser could read
the previous applicant's withdrawal.

## Migration

The migration is a single change with no data migration and no API change.

- **Old keys are discarded, not migrated.** Every previous root
  (`['scholarships']`, `['application-drafts']`, `['atomic-applications']`,
  `['application-windows']`, `['duplicate-applications']`,
  `['scholarship-scopes']`, `['sponsor-team']`, `['sponsor-orgs']`,
  `['configurable-form-schemas']`, `['scholarship-application-validation']`)
  is replaced. On deploy the old entries are unreachable and are dropped by
  garbage collection, and every mounted query refetches once. This is a
  deliberate cold cache: carrying entries across would defeat the identity
  scope.
- **No persisted-cache migration.** A user mid-task on a long application form
  keeps their draft, because drafts live in their own persisted store, not in
  the query cache. Read-only views refetch.
- **Rollback.** Reverting the commit restores the old roots. Nothing persisted
  by the new code is read by the old code, so rollback is clean.

### Transport changes that shipped with this work

These were found while consolidating the keys and are worth knowing about
during review:

- `scholarshipFetch` already accepted a bearer token, but **no call site passed
  one**, so all fifteen scholarship requests were issued unauthenticated. The
  token is now read from the auth store inside `authFetch`, so a new endpoint
  cannot ship without auth by omission.
- `scholarshipFetch` serialises `init.body` itself, but callers were passing an
  already-stringified payload, so every POST body was **double-encoded** and the
  server received a JSON string rather than an object. Call sites now pass the
  object.
- `submitApplication`, program-terms, award-inventory and withdrawal writes used
  a bare `fetch` with no `Authorization` header. All now go through `authFetch`.
  The award-decision writer keeps its injectable `fetch` seam for tests and
  gained the header instead.
- `AuthUser` gained `tenantId`. Four call sites were already reading
  `user.tenantId` against a type that did not declare it.

## Operational impact

- **One extra refetch per identity on deploy.** Expected, bounded, and one-off.
- **Request volume per mutation is now explicit.** The matrix is the answer to
  "why did that decision fire six requests". Rows are deliberately narrow: a
  milestone decision with a known award id refetches one schedule, not every
  award's schedule.
- **Monitoring.** A regression here shows up as users reporting stale data after
  an action, not as an error. When adding a row, prefer a missing invalidation
  over a broad one, and add the assertion test in the same change.
- **Bundle.** The factory and matrix are small and tree-shake to the namespaces
  actually imported.
- **Devtools.** React Query Devtools is enabled outside production. Keys are now
  safe to inspect: they contain identity identifiers, not credentials or
  applicant content.

## Troubleshooting

**A view stays stale after a mutation.**
The mutation is probably not routed through the matrix. Grep for
`invalidateQueries` inside `src/features/scholarships` — outside `lib/` and the
feature's own `hooks.ts` files, a direct call is a finding. Confirm the row
lists the namespace the view actually reads.

**A mutation invalidates far more than expected.**
The caller is not passing the ids the server returned, so the row widened from
`detail` to the collection. Check the `onSuccess` context argument.

**Two requests fire for what looks like one view.**
Two different namespaces back the same screen (for example `awards` and
`applications` both feed the award hub). Both rows are correct; the screen needs
both.

**Data from the previous user appears.**
Sign out and back in and check `clearUserScopedCache` is still wired into
`authStore`. Confirm the key really includes the identity scope by inspecting
the key in Devtools.

**An invitation shows a stale or incorrect verdict.**
The verdict is cached under a digest of the token with `staleTime: 0` and
`gcTime: 0`. If a revoked invitation still validates, the API is the source of
truth here; the client is configured not to serve a cached answer across mounts.

**A test fails with "No QueryClient set".**
The component uses a mutation and the test renders it bare. Wrap it in a
`QueryClientProvider`; see
`disbursements/payments/__tests__/PaymentExecutionPanel.test.tsx`.
