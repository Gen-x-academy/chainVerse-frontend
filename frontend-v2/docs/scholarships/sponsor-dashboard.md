# Sponsor program dashboard (`closes #1133`)

## What this is

A sponsor-facing dashboard at `/scholarships/dashboard/sponsor` covering budget,
application funnel, review progress, and impact for the programs a sponsor funds.

Three properties are enforced in the domain layer, not left to callers:

- **Scope.** `assertSponsorScope` refuses a `programId` outside
  `SponsorScope.programIds` and says which sponsor would need to add it, so the
  refusal is auditable and another sponsor's data is never fetched.
- **Honest budget arithmetic.** Remaining is `budget − committed`, clamped at
  zero, and an overspend is reported through `overspent` and shown as
  "over budget by X" rather than as a negative remainder.
- **Definitions and freshness.** Every impact indicator ships with the
  `definition` it was computed from, and the dashboard carries a `Freshness`
  badge; past `FRESHNESS_MAX_AGE_SECONDS` it is labelled "data is stale" and
  warns against funding decisions.

Reconciliation against the ledger is stated in words on the page, in both
directions.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/dashboards/sponsor/**`).
- **Access:** the owning sponsor, plus finance and administrators. The `allowed`
  prop is a UX guard only; the API must re-check the scope.
- **Data ownership:** the sponsor account, reconciled against the Academy
  finance ledger.

## Privacy

- Funnel counts only. No application essays, scores, or financial-aid answers are
  rendered or requested.
- Reviewer identity is not exposed through review-progress counters.
- Impact indicators must be aggregate and must state their definition, so an
  indicator cannot become a re-identification surface.

## Migration

- Additive only; reads `/scholarships/dashboard/sponsor/{sponsorId}` and passes
  `programIds` explicitly so the backend can enforce the same scope.
- The scope argument is part of the request contract; an endpoint that ignores it
  is a privacy defect, not a client fallback case.

## Operational impact

- Dashboard load is one request; a slow ledger reconciliation shows as "does not
  reconcile" rather than blocking the page.
- Watch the stale-data rate — a rising freshness age usually means the
  aggregation job behind the dashboard has stopped.
- An out-of-scope program produces a visible refusal, which is a signal worth
  alerting on: it means a role or scope regression upstream.

## Verify

```bash
npx vitest run src/features/scholarships/__tests__/sponsor-dashboard.test.ts \
  src/features/scholarships/dashboards/sponsor
npx tsc --noEmit 2>&1 | grep -E "src/features/scholarships/dashboards/sponsor/"  # expect nothing
```

Route smoke: `/scholarships/dashboard/sponsor` — request a program outside the
sponsor's scope and expect the out-of-scope note; break the ledger totals and
expect "does not reconcile".
