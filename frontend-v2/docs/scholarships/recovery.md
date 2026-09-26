# Recoveries and clawbacks (`closes #1130`)

## What this is

A finance-facing surface for reclaiming funds from an awarded scholarship, at
`/scholarships/recovery`. Each `RecoveryClaim` records what was requested, what
has been collected, why, and under what authority.

The central invariant: **a recovery never silently debits a wallet.** An
instruction is only ever produced when all of the following hold, and the UI
says which one is missing rather than presenting a dead button:

1. the claim has a real `legalBasis` (`program-terms`, `signed-agreement`,
   `court-order`, or `policy-9.2` — never `none`),
2. the claim status is `approved`,
3. money is still outstanding,
4. the requester supplies an explicit `authorizationId`.

Collections are append-only. A collection is never edited or deleted: a
reversal appends a new reversing entry, so the original collection and its
ledger entry survive and the net effect is zero.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/recovery/**`).
- **Access:** finance, sponsor, and administrator. The `canManage` prop is a UX
  guard only; the API enforces the same grant (ADR-001).
- **Data ownership:** Academy finance group. No student-facing surface may
  import this module.

## Privacy

- Amounts are integer minor units with an explicit `currency`; they are never
  summed across currencies and are formatted with `Intl.NumberFormat`.
- The panel shows the `studentId` on a claim, so it must stay on finance-only
  routes. It is never rendered in student or sponsor-facing dashboards.
- Free-text `notes` are finance-only and are not exported or logged client side.
- Status is always paired with a word ("Balanced", "No legal basis — recovery
  blocked") so nothing depends on colour.

## Migration

- Additive only. No existing page, module, or store is replaced, and
  `src/features/scholarships/index.ts` is untouched.
- The module reads `/scholarships/recovery/claims*`; until the backend exists
  the panel renders its loading, error, or empty state rather than fake data.

## Operational impact

- Every issued instruction is idempotent on `authorizationId`; re-submitting the
  same id must not produce a second debit.
- Watch: instructions issued without a `legalBasis` (should be impossible — a
  non-zero count is a client bug), and reconciliation discrepancies, which are
  rendered as a badge rather than logged silently.
- Rate limiting and idempotency keys (ADR-001 invariants 5 and 8) are assumed by
  the backend; `429`/`409` responses surface inline.

## Verify

```bash
npx vitest run src/features/scholarships/__tests__/recovery.test.ts \
  src/features/scholarships/recovery
npx tsc --noEmit 2>&1 | grep -E "src/features/scholarships/recovery/"  # expect nothing
```

Route smoke: visit `/scholarships/recovery` as a non-finance role and expect the
permission note; as finance, select a claim with no legal basis and expect the
issue control to stay disabled with the reason shown.
