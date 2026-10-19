# MENTOR-064: Private participant notes

## Scope

Each participant can keep personal notes on an engagement. Notes are
**owner-only**: they are never visible to the counterpart, reviewers, staff or
the public profile.

- `src/features/mentorship/notes/private-notes.ts` — types, owner-only policy,
  validation, search, export, deletion policy, log redaction, stable errors.
- `private-notes.service.ts` — typed API client and analytics.
- `components/PrivateNotesPanel.tsx` — responsive, accessible UI with loading,
  empty, error, denied and success states.
- `private-notes.fixtures.ts` — deterministic synthetic fixtures.

## Privacy boundaries

- **Authorization is deny-by-default.** Only `viewer.userId === note.ownerId`
  grants access. There is no role, staff, reviewer or counterpart override.
  Anonymous viewers get a denied state and no notes.
- **Search cannot leak snippets.** `searchOwnNotes` searches the viewer's own
  notes and returns note ids only — no excerpt, highlight, offset or count. A
  minimum query length avoids single-character probing.
- **Export is owner-only.** `buildNotesExport` includes only the requester's
  non-deleted notes and omits owner ids of other users. It is never added to
  agreement exports (see MENTOR-052, which excludes private notes).
- **Logs contain no note text.** Use `redactNoteForLog` (id, engagement, version,
  length). Errors use fixed messages and never echo server text. Analytics events
  carry `private_note`, the note id and action only.
- **Deletion follows policy.** `evaluateNoteDeletion`: non-owners are denied,
  notes under `retentionHold` are blocked (`DELETION_BLOCKED`), and deleting an
  already-deleted note succeeds without further effect. The UI requires an
  explicit confirmation step.
- Notes are never cached in browser storage by this module.

## Idempotency and errors

- Create sends a per-draft `idempotencyKey`, reused on retry until the save
  succeeds, so retries cannot create duplicates.
- Update sends `expectedVersion`; a mismatch is `VERSION_CONFLICT`.
- Stable error codes: `NOT_AUTHORIZED`, `INVALID_NOTE`, `INVALID_SEARCH`,
  `NOT_FOUND`, `VERSION_CONFLICT`, `DELETION_BLOCKED`. Unknown failures map to
  `NOT_AUTHORIZED` (fail closed) with a fixed message.

## Accessibility

Labelled form fields, a live region for results, `role="status"` for loading,
empty and success messages, `role="alert"` for errors, native buttons (keyboard
operable), 44px touch targets and a layout that stacks on narrow screens.

## Dependencies

- **Backend/API** must implement and enforce owner-only checks on:
  - `GET/POST /mentorship/engagements/{engagementId}/notes` (POST honours
    `idempotencyKey`)
  - `PUT/DELETE /mentorship/engagements/{engagementId}/notes/{noteId}`
    (PUT honours `expectedVersion`; DELETE is idempotent and honours holds)
  - `GET /mentorship/notes/export` (requester's notes only)
  - `POST /mentorship/analytics/events` (stage `private_note`)
- Notes should be encrypted at rest and excluded from logs, search indexes
  visible to others, support tooling and agreement exports.
- **Contracts**: note entity and retention-hold semantics (MENTOR-109/110).
- **Mobile**: must apply the same owner-only, id-only search and export rules.

## Rollout

1. Ship API endpoints with owner-only enforcement and encryption at rest.
2. Verify with cross-user tests that counterpart, reviewer and staff receive
   `NOT_AUTHORIZED` and no note text appears in logs or search indexes.
3. Enable behind the mentorship capability flag for an internal cohort.
4. Roll out to mentors and mentees; monitor `NOT_AUTHORIZED`,
   `VERSION_CONFLICT` and `DELETION_BLOCKED` rates.
5. Wire the panel into the engagement page once the endpoints are live; the
   panel is intentionally presentation-only.

## Tests

`notes/__tests__` covers owner-only listing for counterpart/reviewer/anonymous,
validation, id-only search, owner-only export, deletion policy (including
retry and holds), log redaction, error mapping, analytics, and component states:
loading, empty, denied, create with idempotency-key reuse on retry, validation,
keyboard edit, delete confirmation, and search.
