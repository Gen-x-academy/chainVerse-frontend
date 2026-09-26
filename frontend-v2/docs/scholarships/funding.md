# Sponsor deposits and funding rounds

Closes **#1127**. Module: `frontend-v2/src/features/scholarships/funding/`.
Route: `/scholarships/funding`.

## What this is

A funding surface for sponsor money coming in. A `Deposit` binds both an
`AssetBinding` (asset code, optional issuer, verified source account) and an
amount in integer minor units with an explicit `currency`; a deposit with an
unbound source is rejected as `source-mismatch`. The dedupe key is
`reference` **or** `clientToken`: `detectDuplicate` refuses the second
presentation of the same money, and `recordDeposit` throws rather than writing
a duplicate. `FundingRound` tracks committed versus target with `roundProgress`
and `canFundRound`. Moving an allocation between programs is a
`ReallocationRequest` that a **distinct** authorizer must approve with a
documented reason — the original allocation is never edited in place.

Rejection reasons: `unknown-asset`, `source-mismatch`, `below-minimum`,
`duplicate-reference`, `round-closed`, `amount-exceeds-target`.
`MINIMUM_DEPOSIT_CENTS` is `100_00`.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/funding/**`).
- **Roles:** `sponsor`, `finance`, `administrator` may record deposits and
  authorize reallocations. Students and reviewers have no access.
- **Backend contract:** `/scholarships/funding` — `deposits`,
  `deposits/:id/credit`, `rounds`, `reallocations`. Recording posts an
  `idempotencyKey`; the API is the second line of defence against a double
  credit (ADR-001).
- **Review ownership:** feature-founder **and** a finance product
  representative must approve any change to `MINIMUM_DEPOSIT_CENTS`, the
  accepted asset list, or the distinct-authorizer rule.

## Privacy

- Amounts are integer minor units with the `Cents` suffix and an explicit
  `currency` on the deposit, the reallocation, and the round.
- **Currencies are never mixed.** A round's target is compared only against
  deposits in the same currency, and `applyReallocation` refuses to move money
  between currencies.
- The source account is a verified treasury identifier, never a private key or
  a seed phrase. Asset issuers are public identifiers.
- Funding screens carry no applicant data — no essays, scores, or financial-aid
  answers — and must not be logged with sponsor free text beyond the deposit
  reference.

## Migration

- Additive only; no existing page, module, or store is replaced, and the
  scholarships barrel is imported around rather than edited.
- **History is never edited, only reversed.** A deposit that has been credited
  and then found to be wrong moves to `reversed`; a corrected allocation is
  applied as a new, authorized reallocation request. Neither path rewrites the
  original record, and the original stays on file.
- Existing sponsor balances are not migrated: the page renders loading, empty,
  and error states until the funding endpoints exist.

## Operational impact

- Deposits are the highest-risk write path here because a duplicate credit
  creates real money out of nothing. The client dedupe is advisory; the
  `clientToken` idempotency key and the API's unique constraint are
  authoritative.
- Metrics to watch: duplicate-reference rejection rate (a spike suggests a
  retrying integration), credits stuck in `recorded`, and reallocations sitting
  in `requested` (an approval bottleneck).
- An open round at or over target must reject deposits rather than silently
  over-commit a program.

## Verify

- `npx vitest run src/features/scholarships/__tests__/funding.test.ts` —
  duplicate detection by reference and by client token, minimum deposit,
  round-target limits, and the distinct-authorizer plus reason rule.
- `npx vitest run src/features/scholarships/funding` — loading, empty, error,
  permission, duplicate-warning, `aria-invalid`/`aria-describedby`, and
  `role="progressbar"` component states.
- `npx tsc --noEmit 2>&1 | grep -E "scholarships/funding/"` — must print
  nothing.
