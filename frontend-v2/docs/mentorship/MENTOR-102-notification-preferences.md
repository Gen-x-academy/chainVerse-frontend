# MENTOR-102 — Mentorship notification preferences

Closes #1349. Shared work item: **MENTOR-102** (Communication track). Surface:
`/mentorship` notification settings.

## Scope

Users choose the channels (`in_app`, `email`, `sms`, `push`) permitted for each
category: `application`, `proposal`, `session`, `task`, `payment`, `safety`,
`marketing`. Preferences apply promptly and every change bumps the preference
`version` and `updatedAt` so the backend can audit modifications.

## Behaviour

- **Mandatory categories** (`payment`, `safety`) cannot be disabled; attempts
  throw and the UI shows `MANDATORY_DISCLOSURE`. Transactional notices are
  always labelled `transactional` so they can never be mistaken for marketing.
- **Marketing** is opt-in only: it is off by default and enabling it through the
  generic toggle throws; callers must use `optInToCategory` with explicit
  channels (consent record).
- **Quiet hours** are evaluated in the user's IANA `timeZone`, including ranges
  that wrap midnight. `safety` notices bypass quiet hours; all other categories
  respect them.

## APIs

`defaultNotificationPreferences`, `setCategoryChannel`, `optInToCategory`,
`withinQuietHours`, `decideDelivery`, `isMandatoryCategory`, `isOptInCategory`.

## Dependencies & privacy

- Backend persists preferences and enforces the same mandatory/opt-in rules.
- Only category+channel selections are stored; no message content.

## Rollout

Deny-by-default: new categories ship disabled until explicitly enabled. Ship the
backend rules before removing client-side validation.

## Tests

`npx vitest run src/features/mentorship/__tests__/notification-preferences.test.ts`
covers defaults, mandatory/opt-in enforcement, idempotent toggles, and
time-zone-aware quiet hours.

## Related MENTOR-102 work

Backend/contracts must expose preference read/write with audit history.
