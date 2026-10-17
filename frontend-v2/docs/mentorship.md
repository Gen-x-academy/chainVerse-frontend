# Mentorship workflows (issues MENTOR-012 .. MENTOR-015)

The mentorship feature lets organizations run 1-on-1 and small-group mentorship
programs on top of the ChainVerse platform. Mentors help students reach learning
goals, organizations coordinate cohorts, and completion is backed by
on-chain attestations. This document covers the four workflow subdomains
implemented here; the shared vocabulary (MENTOR-001), capability configuration
(MENTOR-002), and role matrix (MENTOR-003) are documented under
`docs/mentorship/`.

## Shared concerns

- **Roles.** The feature recognizes the mentorship vocabulary from
  `rbac.ts` (`student`, `tutor`, `mentor`, `guardian`, `organization-staff`,
  `moderator`, `finance`, `administrator`). The signed-in user's auth-store
  entry still carries the legacy `admin | instructor | student` roles, so
  pages map them through `identity/access.ts#toIdentityRole` before the
  check.
- **Stable public identifiers.** Every record carries an opaque, stable
  `publicId` that is safe to expose and searchable, plus a `correlationId`
  used to group retries and event logs. The relational key (`internalId`)
  stays private to the API and is never rendered.
- **Authorization.** All reads, writes, and reviews are deny-by-default. Each
  section is guarded by `canAccessMentorshipArea` (see `rbac.ts`), and staff
  actions follow the least-privilege matrix; the API re-enforces every grant
  server-side.
- **Analytics.** The subdomains emit analytics events (`analytics.ts`) with an
  opaque actor key and a retry-safe dedupe key, and never send private user
  data with an event.
- **States.** Every subdomain keeps an explicit status for the entities it
  manages (mentor availability, credential claims, trust indicators, and
  program visibility) instead of overloading booleans.

## Domain map

| Area | Owner | Purpose |
| ---- | ----- | ------- |
| Mentor availability | mentor and staff | accepting requests, limited availability, waitlist-only, temporarily unavailable, inactive |
| Credential verification | moderator | credential claims, review decisions, and audit trail |
| Trust indicators | student and staff | explainable completion, verification, response, delivery, and safety indicators |
| Organization programs | organization-staff | draft programs, publish them, and keep them discoverable |

Areas are implemented under `src/features/mentorship/`, each with its own
folder (for example `availability/`, `trust/`, and so on), and are reachable
from `/mentorship/<area>` routes.

## Availability (MENTOR-013)

- Files: `src/features/mentorship/availability/`; route `/mentorship/availability`.
- Staff schedule mentor statuses through effective windows
  (`effectiveFrom`/`effectiveUntil`); `resolveAvailabilityStatus` derives the
  window that covers `now`, and reports `inactive` when no window covers it.
- Analytics events are emitted on every saved window under the
  `mentor_availability` stage.

## Credential verification (MENTOR-012)

- Files: `src/features/mentorship/credentials/`; route `/mentorship/credentials`.
- Moderators (and administrators) approve or reject credential claims with a reason; the decision
  (`reviewedBy`, `reviewedAt`, `reviewNote`) is retained as an audit trail.
  Approved claims expire automatically once `expiresAt` passes (see
  `resolveCredentialStatuses`).
- Evidence documents are only referenced, never rendered here; the API
  enforces moderator/administrator-only access.

## Trust indicators (MENTOR-014)

- Files: `src/features/mentorship/trust/`; route `/mentorship/trust`.
- `computeTrustIndicators` derives completion, verification, response,
  delivery, and safety scores from explicit activity counters only. Scores are
  capped at 100, never self-awarded, and sparse activity is flagged instead of
  being filled with invented data.
- Analytics events carry an opaque actor key and retry-safe dedupe keys.

## Organization programs (MENTOR-015)

- Files: `src/features/mentorship/programs/`; route `/mentorship/programs`.
- Staff validate drafts client-side (`validateProgramDraft`), save them, and
  publish them explicitly. Drafts are not rendered by the student-facing
  `PublishedProgramList`, which also filters to `published` records at render
  time as defense in depth.
- Analytics events cover draft creation and publication under the
  `organization_programs` stage.

## Services and states

Until the mentorship API exists, every service call (list, review, update,
publish) keeps the flow usable: stores fall back to their persisted local
cache, and list endpoints that fail with an empty cache surface an explicit
error state. Loading, empty, error, and success states are rendered
explicitly by every panel, and all 1-on-1 payments proposals stay tied to the
smart-contract flow once the backend lands.

