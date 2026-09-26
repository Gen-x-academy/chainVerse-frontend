# Treasury reconciliation

Closes **#1126**. Module: `frontend-v2/src/features/scholarships/treasury/`.
Route: `/scholarships/treasury`.

## What this is

A read-and-compare surface over treasury balances and the liability book.
`computePosition` rolls accounts up into a `TreasuryPosition`
(`netCents = availableCents − payableCents`). `runReconciliation` produces an
immutable `ReconciliationRun` snapshot containing a `Discrepancy[]` list and an
alert id per discrepancy. `evaluateAwardGate` decides whether new awards may be
committed: insolvency, an in-progress run, or any unacknowledged drift blocks
them. `acknowledgeDiscrepancy` returns a **new** run and leaves prior runs
untouched.

Discrepancy kinds: `account-mismatch`, `unrecorded-liability`,
`currency-mismatch`, `stale-source`, `variance`.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/treasury/**`).
- **Roles:** `finance`, `sponsor`, `administrator` may run reconciliation and
  acknowledge discrepancies. Students and reviewers are read-only here.
- **Backend contract:** `/scholarships/treasury` — `position`, `accounts`,
  `liabilities`, `reconciliation-runs`, `before-award`. The API enforces the
  same grants; the route guard is a UX boundary only (ADR-001).
- **Review ownership:** feature-founder **and** a finance product
  representative must approve any change to the award gate rules or the
  discrepancy taxonomy.

## Privacy

- All monetary values are integer minor units with the `Cents` suffix and an
  explicit `currency` that travels with the value. Amounts are formatted
  client-side with `Intl.NumberFormat`.
- **Currencies are never mixed.** A position is aggregated per currency; a
  foreign-currency account or liability is reported as a `currency-mismatch`
  discrepancy rather than being converted or folded into a total.
- Treasury data is financial, not applicant data: no essays, scores, or
  reviewer notes are rendered or logged on this surface.
- Account identifiers are treasury account ids, never wallet private keys.

## Migration

- Additive only. No existing page, module, or store is replaced, and
  `src/features/scholarships/index.ts` is intentionally left untouched — the
  route imports directly from the module barrel.
- **History is never edited, only reversed.** Reconciliation is repeatable: the
  same accounts, liabilities, and `asOf` produce the same run id, so re-running
  is safe. A correction is recorded as a new run; an earlier run is never
  mutated or deleted, and acknowledging a discrepancy appends a new run rather
  than amending the original.
- Until the backend exposes the endpoints, the page renders its loading, empty
  ("no run yet"), and error states rather than fabricated balances.

## Operational impact

- Read-heavy: one reconciliation run produces a discrepancy list and alerts and
  then writes nothing. Failures therefore cannot corrupt balances.
- Metrics to watch: run failure rate, drifted-to-balanced ratio, and the number
  of runs blocked by the award gate (a sustained non-zero value means the
  treasury is structurally underfunded).
- A `before-award` call is on the award commit path; if the treasury API is
  unreachable the gate must fail closed (blocked), not open.

## Verify

- `npx vitest run src/features/scholarships/__tests__/treasury.test.ts` —
  position maths, currency safety, drift detection, repeatability, award gate,
  and acknowledgement preserving prior runs.
- `npx vitest run src/features/scholarships/treasury` — loading, empty, error,
  permission, run-history, and acknowledgement component states.
- `npx tsc --noEmit 2>&1 | grep -E "scholarships/treasury/"` — must print
  nothing.
