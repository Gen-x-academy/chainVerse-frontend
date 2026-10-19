# MENTOR-062: Collaborative session agendas

## Scope

Participants propose, edit, reorder, assign, resolve, reopen and withdraw agenda
items for a session, with a revision history and a pre-session cutoff.

- `src/features/mentorship/agenda/agenda.ts` — command model, authorization,
  conflict detection, content safety, cutoff rules, history, export, log
  redaction, stable errors.
- `agenda.service.ts` — typed API client and analytics.
- `components/AgendaBoard.tsx` — responsive, accessible board with loading,
  empty, denied, locked, conflict, error and success states.
- `agenda.fixtures.ts` — deterministic synthetic fixtures.

## Collaboration model

- Every change is a command `{ commandId, baseVersion, command }`. The agenda
  `version` increases by one per applied command.
- **Concurrent edits.** A `baseVersion` that is not the current version is
  `VERSION_CONFLICT`; the UI explains it and offers “Reload agenda”.
- **Retries.** A `commandId` already in the history is a no-op that returns the
  same agenda, so retries never duplicate items or revisions. The UI keeps the
  same `commandId` across failed attempts of one action and issues a new one
  after success or a conflict.
- **Authorship is visible.** Each item shows who proposed it, who it is assigned
  to and who resolved it, using display labels (ids are never shown).
- **Who can do what.** Participants propose, reorder, assign and resolve.
  Only the author edits or withdraws their own item. Coordinators can view and
  export but cannot change anything. Everyone else is denied.
- **Traceability.** Resolved and withdrawn items stay in the list in place.
  Resolving records outcome (`covered`, `deferred`, `dropped`), actor and time.
  Reopening clears the live resolution, and the earlier `resolved` and
  `reopened` entries remain in the append-only history. Resolved and withdrawn
  items cannot be edited, reordered or reassigned.
- **Cutoff.** Propose, edit, reorder, assign and withdraw lock
  `cutoffMinutesBeforeStart` (default 60) before the session. Resolve and reopen
  stay available so the agenda can be closed out during and after the session.
  The limit is `maxItems` (default 30).

## Unsafe content

Titles (≤ 120) and notes (≤ 1000) are **rejected**, not silently rewritten, if
they contain `<` or `>`, script-style URL schemes (`javascript:`, `data:`,
`vbscript:`) or control/bidirectional-override characters. The UI renders text
as plain text only, never as HTML.

## Export

`exportAgenda` is limited to participants and coordinators and returns items
with a 1-based `position` in agenda order, including resolved and withdrawn
items with their resolution. `agendaExportToText` renders the same order.
Revision history is not part of the export.

## Privacy and logging

Agenda text is visible only to participants and coordinators. Logs use
`redactAgendaForLog` (session id, version, count). Analytics events use the
`session_agenda` stage and carry the action and session id only.

## Errors

Stable codes: `NOT_AUTHORIZED`, `CUTOFF_PASSED`, `VERSION_CONFLICT`,
`UNSAFE_CONTENT`, `INVALID_ITEM`, `ITEM_LOCKED`, `LIMIT_REACHED`, `NOT_FOUND`.
HTTP 404/409/423/400/422 map to the matching code; anything unknown fails
closed as `NOT_AUTHORIZED`. Messages are fixed and never echo server text.

## Accessibility

Ordered list semantics, labelled inputs and selects, reorder via “Move up/down”
buttons instead of drag-and-drop (keyboard and screen-reader friendly),
descriptive button names that include the item, `role="status"` for loading,
empty, locked and success text, `role="alert"` for errors, 44px targets and a
stacked layout on narrow screens.

## Dependencies

- **Backend/API** must implement and enforce the same rules on:
  - `GET /mentorship/sessions/{sessionId}/agenda`
  - `POST /mentorship/sessions/{sessionId}/agenda/commands` (idempotent by
    `commandId`, optimistic concurrency by `baseVersion`, HTTP 409 on conflict,
    423 after the cutoff)
  - `GET /mentorship/sessions/{sessionId}/agenda/export`
  - `POST /mentorship/analytics/events` (stage `session_agenda`)
  The backend owns the session start time, cutoff configuration, persistence of
  the history and server-side content validation.
- **Contracts**: session schedule and agenda item/revision schema.
- **Mobile**: must apply the same command, conflict, cutoff and content rules.

## Rollout

1. Ship endpoints with idempotency, version checks, cutoff enforcement and
   content validation.
2. Test two-user concurrent edits, retries and cutoff boundaries (including time
   zones, since the cutoff is computed from the UTC session start).
3. Enable for an internal cohort; watch `VERSION_CONFLICT`, `CUTOFF_PASSED` and
   `UNSAFE_CONTENT` rates.
4. Roll out to all mentors and mentees; revisit the default cutoff per program.
5. Mount the board on the session page once the endpoints are live; it is
   presentation-only.

## Tests

`agenda/__tests__` covers deny-by-default access, authorship and revisions,
author-only edit/withdraw, unsafe content, length limits, reorder and assign,
stale-version conflicts, exactly-once retries, the cutoff, resolved-item
traceability, order-preserving export, log redaction, error mapping, analytics,
and board flows: states, retry with a stable command id, conflict and reload,
keyboard reorder, assignment, resolution and lock behaviour.
