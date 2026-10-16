# MENTOR-008 — Mentor professional profiles

Closes #1255. Source: `src/features/mentorship/identity/profiles/`.
Shared work item: **MENTOR-008** (Identity track).

## What this is

The mentor-authored professional profile: headline, biography, expertise node
ids, teaching languages, time zone, years of experience, teaching approach, and
outbound links. A mentor drafts privately, then publishes once every required
field validates.

## Draft versus publish

- `validateMentorProfile` returns field-scoped errors
  (`HEADLINE_REQUIRED`, `EXPERTISE_REQUIRED`, `LANGUAGES_REQUIRED`,
  `TIMEZONE_REQUIRED`, `EXPERIENCE_OUT_OF_RANGE`, `INVALID_LINK`, …).
- `canPublishMentorProfile` is the transition gate: it is `true` only when the
  profile validates **and** carries a non-empty biography. A draft is always
  storable; it is not always publishable.

## Visibility and field projection

`projectMentorProfile(profile, viewer)` is the only read path:

| Viewer | Receives |
| --- | --- |
| Owner (`viewer.userId === profile.userId`) or staff | every field, including `internalNotes` |
| Anyone else, `visibility: published` | `MENTOR_PROFILE_PUBLIC_FIELDS` only |
| Anyone else, `draft` / `private` | `{ id, userId, visibility }` only |

`internalNotes` is owner/staff-only and never appears in the public field list,
so it cannot be serialised to another viewer.

## Revision auditing

`recordMentorProfileRevision(previous, next, editorId)` diffs two versions with
`changedMentorProfileFields` and records the changed field names, the editor, and
the time. A first save records `changedFields: ['created']`.

## API

`mentorshipProfileService` maps to `/mentorship/mentor-profiles`:

- `get(mentorId)` — read a profile (projected server-side).
- `save(profile)` — persist a draft via `PUT`.
- `publish(profile)` — `POST .../publish` with the current `version`.
- `revisions(mentorId)` — the auditable change log.

## Dependencies

- **MENTOR-010** provides the stable `expertiseSkillIds` used here.
- **MENTOR-003** governs who may read or edit a profile; this module is the
  frontend projection of that grant.

## Verify

```sh
npx vitest run src/features/mentorship/identity/__tests__/profiles.test.ts
npx tsc --noEmit
```
