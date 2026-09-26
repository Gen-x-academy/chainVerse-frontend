# Scholarships — Ownership, Privacy, Migration, and Operations

Status: Working document for the scholarships feature (`closes #1078` route).

## What this is

A role-scoped frontend for scholarship, sponsorship, and bursary journeys.
Actors: **student**, **sponsor**, **reviewer**, **finance**, **administrator**.

Routes under `/scholarships`:

| Route | Access | Purpose |
| --- | --- | --- |
| `/scholarships` | any authenticated user | Hub with role-scoped entry cards |
| `/scholarships/apply` | student | Open rounds + create/submit application |
| `/scholarships/applications` | reviewer, finance, administrator | Review queue and status updates |
| `/scholarships/awards` | sponsor, finance, administrator | Award / disbursement overview |
| `/scholarships/manage` | administrator | Program and round configuration |

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/**`, `frontend-v2/docs/scholarships/**`).
- **Review ownership:** feature-founder *and* a finance product representative
  must approve any change to `types/scholarship.types.ts` or the role map in
  `utils/scholarshipRoles.ts`.
- **Data ownership:** scholarship data is owned by the Academy finance/product
  group; the frontend is a read-mostly client with two mutations (student
  application submission, finance award/disbursement actions).

## Privacy

- Financial values are transmitted in minor units (`*Cents`) with an explicit
  `currency`. The UI formats client-side with `Intl.NumberFormat` and never
  mixes currencies.
- Reviewer identities are never rendered in student-facing views.
- Sponsor views strip application essays, scores, and financial-aid answers.
- Logging must not emit application essays or reviewer free-text notes.

## Migration

- Additive only: no existing page, module, or store is replaced.
- New routes are registered under `/scholarships`; existing navigation is
  untouched, so this ships without a data migration or redirect map.
- The frontend expects typed endpoints; until the backend provides them the
  pages render their loading/error/empty states rather than fake data.

## Operational impact

- The feature fails softly: each tab isolates its own query error so an
  outage on awards does not take down the application review queue.
- Rate limiting and idempotency keys (invariants 5 and 8 in ADR-001) are
  assumed by the backend; the client surfaces `429`/`409` responses inline.
- Metrics to watch after launch: application submit failure rate, per-role
  access-denied rate (a spike indicates a role-map regression), and silent
  partial failures on the disbursement summary.

## Verify

- `npm run test --workspace frontend-v2` — role/access tests in
  `src/features/scholarships/**/__tests__`.
- Route smoke: visit `/scholarships/applications` as a student and expect the
  consistent access-denied state.

## Modules

Finance-side modules added under `src/features/scholarships/`. Each owns one
doc below, each is `finance`/`sponsor`/`administrator`-scoped, and each treats
money as integer minor units with an explicit `currency` that is never mixed
across lines. **History is never edited, only reversed** in all four.

| Issue | Module | Route | Doc |
| --- | --- | --- | --- |
| [#1126](https://github.com/chainVerse/chainVerse-frontend/issues/1126) | `src/features/scholarships/treasury/` | `/scholarships/treasury` | [treasury.md](./treasury.md) |
| [#1127](https://github.com/chainVerse/chainVerse-frontend/issues/1127) | `src/features/scholarships/funding/` | `/scholarships/funding` | [funding.md](./funding.md) |
| [#1128](https://github.com/chainVerse/chainVerse-frontend/issues/1128) | `src/features/scholarships/fees/` | `/scholarships/fees` | [fees.md](./fees.md) |
| [#1129](https://github.com/chainVerse/chainVerse-frontend/issues/1129) | `src/features/scholarships/refunds/` | `/scholarships/refunds` | [refunds.md](./refunds.md) |

- **treasury (#1126)** — reconciles balances against the liability book into
  immutable, repeatable `ReconciliationRun` snapshots, raises discrepancies and
  alerts without ever editing a balance, and gates new awards on insolvency or
  unacknowledged drift.
- **funding (#1127)** — records sponsor deposits that bind both an asset and a
  verified source account, deduplicates on `reference`/`clientToken` so money is
  never credited twice, tracks round progress against target, and moves
  allocations only through an authorized, audited reallocation request.
- **fees (#1128)** — versions the platform and network fee schedule (one active
  version at a time), quotes fees with integer basis-point arithmetic and a
  documented rounding mode while holding `net + totalFee === gross`, and keeps
  fee revenue in an account separate from scholarship disbursement.
- **refunds (#1129)** — derives refund authority from the caller's role, blocks
  settlement that would make the treasury insolvent, and returns settled
  payments as linked reversals with the original ledger entry retained.

Route guards use `ScholarshipPageShell`; the page-level `allowed` flag is a UX
boundary only — the API enforces the same grants (ADR-001).