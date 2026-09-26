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

| Module | Route | Issue | Access | Doc |
| --- | --- | --- | --- | --- |
| Recoveries and clawbacks | `/scholarships/recovery` | [#1130](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1130) | finance, sponsor, administrator | [recovery.md](./recovery.md) |
| Sponsor financial statements | `/scholarships/statements` | [#1131](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1131) | sponsor, finance, administrator | [statements.md](./statements.md) |
| Student scholarship dashboard | `/scholarships/dashboard/student` | [#1132](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1132) | student | [student-dashboard.md](./student-dashboard.md) |
| Sponsor program dashboard | `/scholarships/dashboard/sponsor` | [#1133](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1133) | sponsor, finance, administrator | [sponsor-dashboard.md](./sponsor-dashboard.md) |

Each module is self-contained under `src/features/scholarships/<module>/` and is
imported directly from its own path; the module barrel
`src/features/scholarships/index.ts` is deliberately not extended.
