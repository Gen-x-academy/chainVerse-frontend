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

| Module | Issue | Doc | Route | Purpose |
| --- | --- | --- | --- | --- |
| `public-pages` | [#1138](public-pages.md) | [public-pages.md](public-pages.md) | `/scholarships/public`, `/scholarships/public/[slug]` | Shareable, indexable program pages built from a strict publish-field whitelist |
| `notification-events` | [#1139](notification-events.md) | [notification-events.md](notification-events.md) | `/scholarships/notifications/events` | Typed notification events with deterministic idempotency keys and per-event payload allowlists |
| `communications` | [#1140](communications.md) | [communications.md](communications.md) | `/scholarships/communications/preferences` | Per-event, per-channel preferences where mandatory notices cannot be switched off |
| `reminders` | [#1141](reminders.md) | [reminders.md](reminders.md) | `/scholarships/reminders` | Timezone-aware deadline and action reminders with quiet hours, dedupe, and auto-cancel |

These four modules are self-contained: they declare their own types and import
directly from their own module path. `src/features/scholarships/index.ts` and
`src/features/scholarships/events.ts` are intentionally not modified.
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
## Modules

| Module | Route | Issue | Access | Doc |
| --- | --- | --- | --- | --- |
| Recoveries and clawbacks | `/scholarships/recovery` | [#1130](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1130) | finance, sponsor, administrator | [recovery.md](./recovery.md) |
| Sponsor financial statements | `/scholarships/statements` | [#1131](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1131) | sponsor, finance, administrator | [statements.md](./statements.md) |
| Student scholarship dashboard | `/scholarships/dashboard/student` | [#1132](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1132) | student | [student-dashboard.md](./student-dashboard.md) |
| Sponsor program dashboard | `/scholarships/dashboard/sponsor` | [#1133](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1133) | sponsor, finance, administrator | [sponsor-dashboard.md](./sponsor-dashboard.md) |

Each module is self-contained under `src/features/scholarships/<module>/` and is
imported directly from its own path; the module barrel
`src/features/scholarships/index.ts` is deliberately not extended.

## Modules

| Module | Route | Issue | Document |
| --- | --- | --- | --- |
| `templates/` — versioned communication templates | `/scholarships/templates` | closes #1142 | [templates.md](./templates.md) |
| `accessibility/` — WCAG conformance audit by journey | `/scholarships/accessibility` | closes #1143 | [accessibility.md](./accessibility.md) |
| `fairness/` — funnel rates, bias audit, proxy screening | `/scholarships/fairness` | closes #1144, closes #1145 | [fairness.md](./fairness.md) |

Each module owns its own `types.ts` (no `enum`, no `any`), a `service.ts` of
exported pure domain functions plus a consolidated `*Service` object on
`apiClient`, one client component, and a thin default-export route. All three
import directly from their own module path; `src/features/scholarships/index.ts`
is not modified.
Each module is self-contained: `types.ts` (types only), `service.ts` (pure
domain functions plus a consolidated `apiClient` service), and `components/`.
They import from their own sub-path, not from the `index.ts` barrel. All four are
available to `administrator` and to the non-admin `finance` role.

| Module | Issue | Route | Doc | What it guarantees |
| --- | --- | --- | --- | --- |
| `flags/` | #1166 | `/scholarships/flags` | [flags.md](./flags.md) | Deterministic cohort rollout per environment; **fails closed** when the flag service is unreachable |
| `concurrency/` | #1152 | `/scholarships/concurrency` | [concurrency.md](./concurrency.md) | A write is applied **or** rejected whole — `ConcurrencyWriteResult` makes a partial mutation unrepresentable |
| `retention/` | #1153 | `/scholarships/retention` | [retention.md](./retention.md) | `financial`/`audit` records are **never** deletable and an active legal hold always wins |
| `abuse/` | #1150 | `/scholarships/abuse` | [abuse.md](./abuse.md) | Denials state explicit `Retry-After` guidance, a bypass needs a service authorization id, and a throttled request **never** truncates a saved draft |

Shared cross-cutting behaviour:

- **Money** stays in integer minor units with an explicit `currency`, formatted
  with `Intl.NumberFormat` (see `concurrency`).
- **Dates** are ISO 8601 strings; timestamps end in `At`.
- **Loading, empty, error, success, and permission-denied** states are all
  rendered in every panel, with `role="status"` / `role="alert"` / `role="note"`,
  a real `<label>` per input, and `aria-describedby` linking every error to its
  field.
- **Pure domain logic only.** No `enum`, no `any`, no `axios`, no Redux, no i18n
  library. Every function that needs a clock takes it as an argument, so window
  rollovers and retention expiry are asserted exactly rather than slept through.
