# MENTOR-063: Privacy-aware attendance

## Scope

Records when mentorship session participants joined, left or checked in, how it
was verified, and how much of the session they attended, without collecting
location, device or biometric data.

- `src/features/mentorship/attendance/attendance.ts` — signal validation,
  authorization, attendance derivation, corrections with audit trail, retention
  partitioning, log redaction, stable errors.
- `attendance.service.ts` — typed API client and analytics.
- `components/AttendancePanel.tsx` — responsive, accessible panel with loading,
  empty, denied, error and success states.
- `attendance.fixtures.ts` — deterministic synthetic fixtures.

## Signals and verification methods

Kinds: `join`, `leave`, `check-in`. Methods: `platform-presence`,
`calendar-link`, `counterpart-confirmation`, `self-report`. A signal is
`{ kind, method, at, attestedBy? }` plus server-side `receivedAt`.

## Privacy boundaries

- **Allowlist only.** Any other field is `INVALID_SIGNAL`; location, IP, device,
  fingerprint, biometric and similar keys are rejected as `PRIVACY_VIOLATION`.
  The UI never asks for, or displays, such data.
- **Raw signals expire.** `rawSignalRetentionDays` (default 30) drives
  `partitionExpiredSignals`. The server must persist the derived summary before
  purging raw signals; summaries are kept.
- **No free text in logs or analytics.** Correction reasons are shown only to
  participants and coordinators; `redactCorrectionForLog` keeps ids, state and
  length. Analytics events (`attendance` stage) carry action and session id.
- Participant ids are not displayed; the UI uses supplied display labels.

## Integrity

- **No self-award.** With `requireCorroboration` (default on), only
  `platform-presence`, `calendar-link`, and `counterpart-confirmation` made by a
  *different* participant count. A participant with only self-reports is
  `pending-corroboration` with 0 counted minutes.
- **Partial attendance.** Status is `attended` (≥ 80% by default), `partial`
  (≥ 25%) or `absent`, with minutes and ratio shown. Rejoins are merged without
  double counting, time is clipped to the scheduled window, and a join with no
  leave counts for at most `maxUnclosedMinutes` (default 5).
- **Recording rules.** Participants record only for themselves, inside the
  session window (± `windowGraceMinutes`). Confirming the other participant needs
  `method: counterpart-confirmation` and `attestedBy` equal to the confirmer.
  Coordinators and administrators can view and decide corrections but cannot
  record.
- **Deterministic.** Output is ordered by participant id; signals by time then id.

## Corrections

Any participant can request a correction (outcome + reason ≤ 500 chars). The
record carries an append-only audit trail (`requested` → `approved`/`rejected`
with actor and time). The requester can never decide their own request
(`SELF_APPROVAL`). Repeating the same decision is a no-op; a different one is
`ALREADY_DECIDED`. The latest approved correction overrides the derived result
and is marked “(corrected)”.

## Idempotency and errors

Recording and correction requests send an `idempotencyKey` that stays the same
across retries until success, so retries do not duplicate effects. Stable codes:
`NOT_AUTHORIZED`, `INVALID_SIGNAL`, `OUTSIDE_WINDOW`, `PRIVACY_VIOLATION`,
`INVALID_CORRECTION`, `SELF_APPROVAL`, `ALREADY_DECIDED`, `NOT_FOUND`. Unknown
failures fail closed as `NOT_AUTHORIZED`; messages never echo server text.

## Accessibility

Labelled controls, `role="status"` for loading, empty and success text,
`role="alert"` for errors, native buttons (keyboard operable), descriptive button
names, 44px touch targets and a stacked layout on narrow screens.

## Dependencies

- **Backend/API** must implement and enforce the same rules on:
  - `GET /mentorship/sessions/{sessionId}/attendance`
  - `POST /mentorship/sessions/{sessionId}/attendance/signals` (`idempotencyKey`)
  - `POST .../attendance/corrections` (`idempotencyKey`)
  - `POST .../attendance/corrections/{id}/decision`
  - `POST /mentorship/analytics/events` (stage `attendance`)
  The backend owns policy configuration, summaries, the retention job, and
  platform/calendar signal sources.
- **Contracts**: session schedule, attendance policy and audit semantics.
- **Mobile**: must use the same allowlist, corroboration, merge and retention
  rules.

## Rollout

1. Ship endpoints with corroboration enforcement, the audit trail and the
   retention job (summary persisted before purge).
2. Verify with cross-user tests that outsiders are denied and requesters cannot
   approve their own corrections.
3. Enable for an internal cohort with `requireCorroboration` on; review
   `pending-corroboration` and correction rates.
4. Tune ratios and retention per program, then roll out to all mentors/mentees.
5. Mount the panel on the session page once the endpoints are live; the panel
   is presentation-only.

## Tests

`attendance/__tests__` covers authorization, derivation (full, partial, rejoin,
unclosed, clipping, determinism), corroboration, privacy rejection, recording
rules, window enforcement, correction audit/self-approval/idempotency,
retention, error mapping, analytics, and panel flows: states, privacy copy,
retry with a stable key, keyboard correction request, and decision rules.
