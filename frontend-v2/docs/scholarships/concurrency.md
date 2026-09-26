# Optimistic concurrency & conflict handling

Closes #1152. Source: `src/features/scholarships/concurrency/`.
Route: `/scholarships/concurrency`.

## What this is

Version-guarded writes for scholarship resources. Every resource carries a
monotonically increasing `version`; a write is applied only when the version the
client still holds matches the server's. Otherwise the write is rejected whole
as a `ConflictError` and nothing is mutated.

The guard is expressed in the type, not in a convention:

```ts
type ConcurrencyWriteResult<T> =
  | { status: 'applied'; value: T }
  | { status: 'conflict'; conflict: ConflictError };
```

There is no third state, so a half-applied write is unrepresentable.
`commitWrite` is the only entry point: it either returns a value with the server
version incremented, or a conflict. `applyOptimistic` is the local-edit helper
and it works on a `structuredClone`, so a mutator that throws leaves the caller's
state exactly as it was — verified by test, not by convention.

`VersionedResourceType` covers `program`, `application`, `review`, `award`, and
`finance`. A write aimed at a different resource than the one the client loaded
is a conflict too, not a silent success.

On a conflict the operator gets a field-by-field table — `buildFieldDiffs`
returns the common base, *yours*, and *theirs* for every field that differs —
and exactly two ways forward:

- **Reload server value** — discard the local edit and adopt the server's.
- **Keep mine (rebase)** — `rebaseOntoServer` re-applies the client's fields on
  top of the current server values, then commits against the *current* version.
  Fields the client did not send keep the server's value, so a rebase never
  resurrects a field the other editor has already moved on from.

## Ownership

- **Code owner:** platform/frontend foundation team
  (`src/features/scholarships/concurrency/**`).
- **Data ownership:** the resource owner named in `VersionedResource.updatedBy`
  is shown on the conflict so the operator knows who they are rebasing against.
- **Roles:** available to `administrator` and to the non-admin `finance` role.
  Without the write grant the panel is read-only: inputs and submit are
  disabled, a `role="note"` explains why, and the next step is spelled out.

## Privacy

- A `ConflictError` carries field names and values from the payload. The panel is
  therefore only mounted on routes the operator is already authorised for; it
  adds no exposure beyond what the editor could already read.
- Reviewer identities are never rendered in student-facing views. A conflict on
  a `review` resource shows `updatedBy`, not a reviewer profile.
- Logging must not emit the compared field values — only the field names, the
  resource id, and the two versions.

## Migration

- Additive only. No existing write path is rewritten; this module is opt-in per
  caller. `src/features/scholarships/index.ts` is untouched — import from
  `@/src/features/scholarships/concurrency`.
- Resources without a `version` cannot be guarded. Until the backend stamps
  versions, `commitWrite` treats the resource as version `0` and a second writer
  will be rejected — the correct failure mode, but rollout should be staged.
- Rollout order: stamp versions on read, then send `expectedVersion` on write,
  then surface conflicts in the UI. Skipping the first step means every
  concurrent write conflicts.
- To retire a guarded write, drop `expectedVersion` from the request. The last
  writer wins again, which is why that is a scheduled step and not a cleanup.

## Operational impact

- Every guarded write is one extra conditional on the server. A conflict rate
  that is not near zero usually means editors are holding tabs open for hours;
  the correct response is a shorter edit session, not a weaker guard.
- Metrics to watch: conflict rate by resource type, rebase-vs-reload split, and
  the count of `applied` writes. An unexplained drop in applied writes with a
  flat edit rate means the version stamping has regressed.
- A conflict is a user-visible dead end unless the UI is present, so a backend
  that starts returning `409` must ship this panel at the same time.
- Cost: none. Detection is arithmetic on the client and the write count does not
  change.

## Verify

- `npx vitest run src/features/scholarships/__tests__/concurrency.test.ts
  src/features/scholarships/concurrency` — stale write rejected, matching
  version applied, no partial mutation, field diffs, rebase, and the component's
  loading / empty / error / permission states and ARIA wiring.
- `npx tsc --noEmit` — no errors in `src/features/scholarships/concurrency/`.
- Route smoke: open `/scholarships/concurrency`, edit the title, press
  *Simulate a concurrent server edit*, then *Submit with the held version* and
  confirm the comparison table appears with both recovery buttons.
- Rebase smoke: press *Keep mine (rebase)* and confirm the save succeeds and
  reports the new version.
