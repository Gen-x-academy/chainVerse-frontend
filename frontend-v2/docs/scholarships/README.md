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