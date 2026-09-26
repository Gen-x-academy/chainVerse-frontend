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
