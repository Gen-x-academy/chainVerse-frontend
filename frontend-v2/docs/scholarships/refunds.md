# Refunds and returned payments

Closes **#1129**. Module: `frontend-v2/src/features/scholarships/refunds/`.
Route: `/scholarships/refunds`.

## What this is

A refund surface that is authority-bound, solvency-bound, and append-only.
`refundAuthorityFor(role)` derives a `RefundAuthority` from the caller's role
and returns `none` for `student`, `reviewer`, and anything unrecognised —
client-supplied authority is never trusted. `canRequestRefund` additionally
requires a sponsor to act on their own program. `checkSolvency(treasury,
pendingRefunds)` blocks a refund that would leave the treasury unable to cover
its payables, and `settleRefund` re-checks it so an already-authorized refund
cannot be settled into insolvency.

Status moves strictly forward: `requested → authorized → processing → settled`,
with `rejected` and `reversed` as terminal outcomes. `reverseEntry` builds a
`ReversalEntry` with the opposite entry type that links back to the original,
and `ledgerAfterRefund` returns the ledger with **both** entries present.

Triggers: `sponsor-request`, `rejected-transfer`, `overpayment`,
`unused-program-balance`, `duplicate-deposit`.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/refunds/**`).
- **Roles:** `finance` and `administrator` authorize and settle; `sponsor` may
  request a refund of their own program's funds only. `student` and `reviewer`
  are always denied.
- **Backend contract:** `/scholarships/refunds` — list, create,
  `/:id` (authorize), `/:id/settlement`, `/:id/reversal`, `/ledger`,
  `/solvency`. Authorization posts an `expectedStatus`; settlement and creation
  post an `idempotencyKey`.
- **Review ownership:** feature-founder **and** a finance product
  representative must approve any change to the authority matrix or to the
  solvency rule. The authority matrix is derived from role server-side; the
  client is a UX boundary only (ADR-001).

## Privacy

- Refund amounts, destination accounts, and ledger entries are integer minor
  units with the `Cents` suffix and an explicit `currency`, formatted with
  `Intl.NumberFormat`.
- **Currencies are never mixed.** `checkSolvency` only counts pending refunds
  denominated in the treasury currency, and `ledgerAfterRefund` refuses to
  reverse an entry whose currency differs from the refund.
- Destination account ids are treasury references. No wallet private key, seed
  phrase, or bank credential is ever sent to or rendered by this surface.
- A refund is a program-level financial record. It must not carry the
  recipient's essay, score, or financial-aid answers into the request payload,
  and the documented `reason` must stay financial (for example "program closed
  with funds unspent") rather than personal.

## Migration

- Additive only; no existing page, module, or store is replaced, and the
  scholarships barrel is imported around rather than edited.
- **History is never edited, only reversed.** A settled payment that turns out
  to be wrong is reversed: the original ledger entry stays, a linked reversal
  entry is appended, and the net ledger effect returns to its prior value. No
  entry is ever deleted or rewritten in place. The same rule applies to refund
  requests: a correction is a new request, and a wrongly settled request moves
  to `reversed`.
- The `clientToken` is the dedupe key, so a retried request returns the
  original refund rather than paying twice.
- Until the backend exposes the endpoints, the page renders loading, empty, and
  error states rather than fabricated refunds.

## Operational impact

- The solvency check is a hard gate on settlement. If the treasury API is
  unreachable, settlement must fail closed (blocked) rather than open.
- Metrics to watch: refunds stuck in `requested` or `authorized`, settlements
  rejected for solvency (a sustained count means programs are over-committed),
  and reversals as a share of settlements (a rising ratio suggests a broken
  disbursement or banking path upstream).
- A reversal must be emitted as a new ledger entry by the same transactional
  write that marks the refund settled; a settled refund with no reversal entry
  is a reconciliation break.

## Verify

- `npx vitest run src/features/scholarships/__tests__/refunds.test.ts` — the
  authority matrix (student and reviewer denied), solvency blocking, status
  transitions, and a reversal that keeps the original entry.
- `npx vitest run src/features/scholarships/refunds` — loading, empty, error,
  permission, solvency-banner, `aria-invalid`/`aria-describedby`, and ledger
  component states.
- `npx tsc --noEmit 2>&1 | grep -E "scholarships/refunds/"` — must print
  nothing.
