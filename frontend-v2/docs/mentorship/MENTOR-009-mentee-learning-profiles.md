# MENTOR-009 — Mentee learning profiles

Closes #1256. Source: `src/features/mentorship/identity/mentee-profiles/`.
Shared work item: **MENTOR-009** (Identity track).

## What this is

The mentee-authored learning profile: goals, current level, interests (taxonomy
node ids), preferred language, time zone, and matching preferences. The mentee
controls visibility, and matching only ever uses a current profile version.

## Visibility and privacy

`visibility` is one of `private | matching | public`. Two fields are sensitive —
`accessibilityNeeds` and `matchingPreferences` — and are listed in
`MENTEE_PROFILE_SENSITIVE_FIELDS`.

`projectMenteeLearningProfile(profile, viewer)` is the only read path:

| Viewer | Receives |
| --- | --- |
| Owner or staff | the full record, including sensitive fields |
| Anyone else, `matching` / `public` | `MENTEE_PROFILE_MATCHING_FIELDS` only |
| Anyone else, `private` | `{ id, userId, visibility }` only |

A mentor never receives `accessibilityNeeds` or `matchingPreferences`.

## Completeness

`computeProfileCompleteness(profile)` returns a `0..1` score over goals,
interests, preferred language, time zone, and matching preferences, plus the
names of the missing fields. The form renders it as a progress bar.

## Matching uses the current version

`createMatchingSnapshot(profile, expectedVersion)` builds the projection a
matching engine may consume. It throws `StaleMatchingVersionError` when
`expectedVersion` differs from `profile.version`, so a match can never be
computed against superseded preferences. Collections are copied so a later
mutation cannot leak into a snapshot.

## API

`mentorshipMenteeProfileService` maps to `/mentorship/mentee-profiles`:

- `get(menteeId)` — read a profile (projected server-side).
- `save(profile)` — persist via `PUT`.
- `match(menteeId, version)` — request matches for an explicit version; the
  server must reject a stale `version`.

## Dependencies

- **MENTOR-010** provides the stable `interests` node ids used here.
- **MENTOR-003** governs who may read or edit a profile.

## Verify

```sh
npx vitest run src/features/mentorship/identity/__tests__/mentee-profiles.test.ts
npx tsc --noEmit
```
