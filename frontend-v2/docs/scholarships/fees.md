# Platform and network fees

Closes **#1128**. Module: `frontend-v2/src/features/scholarships/fees/`.
Route: `/scholarships/fees`.

## What this is

A fee schedule and quoting surface. A `FeeScheduleVersion` is immutable once
written and carries a list of `FeeComponent`s, each with a `FeeBasis`
(`gross-amount`, `net-amount`, `flat-per-award`,
`percentage-of-platform-fee`), a `rateBps` rate in basis points, a
`flatCents` add-on, and an explicit `currency`. Only one version is `active` at
a time; `activeSchedule` picks the in-force version, `nextScheduleVersion`
allocates the next patch, and `supersedeSchedule` returns a new array in which
the previously active version is `superseded`.

`quoteFees` does the arithmetic in integers only — no floats — using
`divideWithRounding` / `applyBasisPoints` with a documented `RoundingMode`
(`half-even`, `half-up`, `down`). The invariant
`netRecipientCents + totalFeeCents === grossCents` holds by construction, so a
recipient is never quietly reduced to make a fee line fit. `splitFeeRevenue`
sums quotes into a `FeeLedgerAccount` (`platformRevenueCents`,
`networkCostCents`) that is accounted **separately** from scholarship
disbursement.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/fees/**`).
- **Roles:** `finance` and `administrator` may create, activate, and supersede
  schedule versions. `sponsor`, `reviewer`, and `student` may read and run the
  calculator but see a permission notice on the version controls.
- **Backend contract:** `/scholarships/fees` — `schedules`,
  `schedules/active`, `schedules/:version/activation`, `quotes`, `revenue`.
  Activation posts an `expectedStatus` so a concurrent activation conflicts
  rather than silently winning.
- **Review ownership:** feature-founder **and** a finance product
  representative must approve any change to the rounding mode default, the
  balance invariant, or the fee-revenue account definition.

## Privacy

- Every component, quote, and ledger amount is integer minor units with the
  `Cents` suffix and an explicit `currency`, formatted with
  `Intl.NumberFormat`.
- **Currencies are never mixed.** `splitFeeRevenue` throws rather than totalling
  quotes across currencies, and the UI explains that the quotes must be
  reconciled first.
- The fee surface handles amounts and schedule metadata only. It must never
  receive or render applicant identity, essay text, or reviewer notes.
- Basis points and rounding modes are public pricing configuration; no fee
  calculation may be logged alongside a recipient identifier.

## Migration

- Additive only; no existing page, module, or store is replaced, and the
  scholarships barrel is imported around rather than edited.
- **History is never edited, only reversed.** Activating a new version marks the
  previous one `superseded`; superseded versions are retained, never deleted or
  rewritten, and a quote always names the exact `scheduleVersion` it was priced
  against so historic quotes stay reproducible.
- A quote is immutable once recorded. A corrected fee is a new quote, and a
  corrected schedule is a new version — never an edit to an old one.
- Until the backend exposes the endpoints, the page renders loading, empty, and
  error states rather than a fabricated schedule.

## Operational impact

- The calculator is client-side and read-only with respect to balances; a
  mistake produces a wrong *quote*, not a wrong *payment*. The API re-quotes
  authoritatively before charging.
- Metrics to watch: balance-invariant assertion failures (should be zero by
  construction — a non-zero count means the invariant was edited), fee revenue
  per currency versus disbursement, and quote-versus-charge divergence.
- An over-large schedule (fees exceeding the gross amount) yields a negative net
  rather than a silently capped one. Monitor for it; it indicates a
  misconfigured schedule, not a rounding artefact.

## Verify

- `npx vitest run src/features/scholarships/__tests__/fees.test.ts` — the
  `net + totalFee === gross` invariant across many amounts, schedules, and
  rounding modes; basis-point maths; half-even boundaries; fee revenue kept
  separate from disbursement; and single-active-version enforcement.
- `npx vitest run src/features/scholarships/fees` — loading, empty, error,
  permission, live-preview, and balance-line component states.
- `npx tsc --noEmit 2>&1 | grep -E "scholarships/fees/"` — must print nothing.
