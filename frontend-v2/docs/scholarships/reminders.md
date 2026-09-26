# Deadline and action reminders (closes #1141)

## What this is

Scheduling for the five reminder kinds — `incomplete-application`,
`pending-review`, `award-acceptance`, `missing-evidence`, `payout-setup` —
computed in the recipient's own IANA timezone, deferred out of quiet hours,
deduplicated, and cancelled the moment the work is done.

- Module: `src/features/scholarships/reminders`.
- Route: `/scholarships/reminders`.
- API base path: `/scholarships/reminders`.

Pure functions: `schedulingPolicy`, `isWithinQuietHours`,
`nextQuietHoursEnd`, `buildSchedule`, `previewSchedule`, `cancelSchedule`,
`dedupeKeyFor`, `localTimeInZone`, `localDateTimeInZone`.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Policy owner:** the program team sets offsets and quiet hours per program;
  the recipient's timezone is never second-guessed.
- **Review ownership:** a change to `DEFAULT_OFFSETS` or to the quiet-hours
  semantics needs feature-founder sign-off, because both change when a human is
  interrupted.

## Privacy

- A reminder references a `NotificationSubject` (`kind` + `id`) and a
  `recipientRef`; it carries no name, email address, phone number, or
  application content.
- Local times (`scheduledForLocal`, `deliverAfterLocal`) are computed with
  `Intl.DateTimeFormat` and an explicit `timeZone` — never a hand-rolled UTC
  offset, which would be wrong for half the year in any DST zone.
- Quiet hours are a recipient-protection control: `isWithinQuietHours` and
  `nextQuietHoursEnd` exist so a reminder cannot wake someone at 02:00 because
  the server guessed their offset.
- The dedupe key contains only the reminder kind, subject kind/id, and the local
  send time, so it is not a fingerprint that can be reversed into a person.

## Migration

- Additive only: a new module and route; no existing scheduler is replaced.
- Every helper takes `now` as an argument — `Date.now()` is never read inside a
  pure function — so a schedule is reproducible in a test and in an incident
  replay.
- `buildSchedule` reports, rather than throws, on each of the five outcomes:
  `scheduled`, `deferred-to-quiet-hours-end`, `duplicate-suppressed`,
  `cancelled-subject-complete`, `no-offset-applicable`. The UI renders a reason
  string for every occurrence, so an operator can see *why* something did not
  fire.
- Offsets are relative to "now" and are applied in absolute hours, then rendered
  locally; `policy.respectRecipientTimezone: false` falls back to
  `SCHEDULER_TIMEZONE` (`UTC`) for platform-wide campaigns.
- Cancellation sends `expectedAttempts` plus an `idempotencyKey` so a retry
  cannot double-cancel or cancel a schedule that has already been resent.

## Operational impact

- Fails softly: load failures render a `role="alert"` panel, a read-only viewer
  gets a `role="note"` permission notice with the controls and the cancel button
  disabled.
- Reminders are the most interruption-sensitive thing in the feature; the
  metrics to watch are the share of occurrences that were deferred out of quiet
  hours (a spike means a policy or timezone problem), the duplicate-suppression
  ratio, and the count of reminders cancelled because the subject completed
  (a good sign, not a failure).
- The preview is computed in the browser from the same pure functions the API
  uses, so an operator sees the real ladder before saving it.

## Verify

- `npx vitest run src/features/scholarships/__tests__/reminders.test.ts
  src/features/scholarships/reminders` — quiet hours including the
  wrap-past-midnight window, quiet-hours end resolution, timezone conversion for
  `UTC`, `America/New_York`, `Europe/London`, and `Asia/Tokyo`, offsets applied,
  dedupe, cancellation after completion, and the component's controls, preview
  reasons, table, validation errors, and permission state.
- Manual: on `/scholarships/reminders`, preview `incomplete-application` in
  `Asia/Tokyo` with quiet hours `22:00`-`07:00` and confirm each occurrence
  shows its local time and a status word, then cancel one and confirm the
  recorded reason.
