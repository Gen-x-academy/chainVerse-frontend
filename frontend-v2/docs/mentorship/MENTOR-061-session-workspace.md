# MENTOR-061: Session workspace

## Scope

A scoped workspace for each booked session that brings together the agenda,
shared goals, permitted resources, attendance state and follow-up actions.

- `src/features/mentorship/workspace/workspace.ts` — access model, permissions,
  retention, resource filtering, follow-up commands, log redaction, stable
  errors.
- `workspace.service.ts` — typed API client and analytics.
- `components/SessionWorkspace.tsx` — responsive, accessible workspace with
  section navigation and loading, empty, denied, read-only, expired, conflict,
  error and success states.
- `workspace.fixtures.ts` — deterministic synthetic fixtures.

The workspace is an aggregate view. It takes agenda items, goals, resources and
attendance as summaries from the API (see MENTOR-062 agendas and MENTOR-063
attendance for the owning modules) and itself only mutates **follow-up
actions**.

## Access

- **Deny-by-default.** Only session participants and staff explicitly listed in
  `scopedStaffIds` enter. Everyone else, including anonymous users and
  unscoped staff, gets a denied state and no content.
- **Staff are read-only** and see only resources whose audience is
  `participants-and-staff`.
- **Role-aware navigation.** `workspaceSections` returns the sections each role
  may reach; “My private notes” is offered to participants only.

## Retention and read-only states

- **Agreement retention.** `retainUntil` comes from the engagement agreement.
  After it, `viewWorkspace` returns an empty shell (status and schedule only),
  only the overview section is offered, and commands fail with `EXPIRED`.
- **Cancelled sessions** stay visible but are read-only (`READ_ONLY`).
- Staff views are read-only.

## Private notes stay separate

Private mentor/mentee notes (MENTOR-064) are not part of the workspace data
model. The workspace only renders an optional `privateNotesSlot` supplied by the
page, for participants, with copy that explains the notes are separate and
visible only to their owner. Staff never receive the slot. The workspace API
must not return note content.

## Resources

Resources are filtered by audience, and only `https://` URLs are rendered as
links (with `rel="noopener noreferrer"` and a screen-reader “opens in a new tab”
hint). Other URL schemes are dropped, leaving the title as plain text.

## Follow-up actions

Add and complete/reopen follow-ups through versioned commands
`{ commandId, baseVersion, command }`:

- a stale `baseVersion` is `VERSION_CONFLICT` (the UI offers “Reload workspace”);
- a repeated `commandId` is a no-op, so retries do not duplicate effects, and
  the UI reuses the same id for failed attempts of one action;
- titles are 1–200 characters; markup, script URLs and control/bidi characters
  are rejected (`UNSAFE_CONTENT`); owners must be participants.

## Privacy and logging

Logs use `redactWorkspaceForLog` (session id, status, version, count). Analytics
use the `session_workspace` stage with the action and session id only. Errors
use fixed messages that never echo workspace text.

Stable codes: `NOT_AUTHORIZED`, `READ_ONLY`, `EXPIRED`, `VERSION_CONFLICT`,
`UNSAFE_CONTENT`, `INVALID_ITEM`, `NOT_FOUND`. HTTP 404/409/410/423/400/422 map
to the matching code; unknown failures fail closed as `NOT_AUTHORIZED`.

## Accessibility

A labelled `nav` with in-page links, headings per section, native checkbox and
form controls with labels, `role="status"` for loading, read-only and success
text, `role="alert"` for errors, 44px targets and a layout that wraps on narrow
screens.

## Dependencies

- **Backend/API** must implement and enforce the same rules on:
  - `GET /mentorship/sessions/{sessionId}/workspace` (scoped by participant /
    scoped staff, resources filtered by audience, retention applied)
  - `POST /mentorship/sessions/{sessionId}/workspace/commands` (idempotent by
    `commandId`, version-checked, 410 after retention, 423 when read-only)
  - `POST /mentorship/analytics/events` (stage `session_workspace`)
- The backend owns staff scoping, retention from the agreement, and assembling
  agenda, goals, resources and attendance from their services.
- **Contracts**: workspace schema, retention and staff-scope semantics.
- **Mobile**: must apply the same access, read-only and retention rules.

## Rollout

1. Ship the endpoints with scoping, retention and read-only enforcement.
2. Verify with cross-user tests that outsiders and unscoped staff are denied and
   that no private note content appears in workspace responses or logs.
3. Enable for an internal cohort; check cancelled-session and post-retention
   behaviour.
4. Roll out to mentors and mentees, then scoped staff; monitor
   `NOT_AUTHORIZED`, `EXPIRED`, `READ_ONLY` and `VERSION_CONFLICT` rates.
5. Mount the workspace on the session page and pass the notes, agenda and
   attendance modules in once their endpoints are live; the component is
   presentation-only.

## Tests

`workspace/__tests__` covers deny-by-default access, role-aware sections,
private-note separation, audience filtering and URL safety, cancelled / staff /
expired read-only behaviour, follow-up commands (versioning, exactly-once
retries, validation), log redaction, error mapping, analytics, and component
states and flows: navigation, denied, loading, empty, read-only, retention,
retry with a stable command id, keyboard toggle and conflict reload.
