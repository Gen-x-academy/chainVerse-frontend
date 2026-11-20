# Capstone proposals: questions, attachments, preflight, submission (CAPSTONE-035 to 038)

Logic modules under `frontend-v2/src/features/capstone/`. They are pure and hold no network or UI code, matching the other capstone modules.

| Work item | Module | What it does |
| --- | --- | --- |
| CAPSTONE-035 | `proposal-questions.ts` | Versioned typed questions, validation, ordering, conditional visibility, escaped rendering |
| CAPSTONE-036 | `proposal-attachments.ts` | Attachment references with purpose, consent, scan state, access policy, retention, hash, deletion status |
| CAPSTONE-037 | `proposal-preflight.ts` | Pass, fail or needs-information result with safe messages and remediation |
| CAPSTONE-038 | `proposal-submission.ts` | Frozen versions, duplicate prevention, idempotent replay |

## Dependencies

- Draft shape: `proposal-drafts.ts` (CAPSTONE-033). Autosave and history modules are unchanged.
- Call rules and versions come from the call modules (`project-calls.ts`, `call-terms.ts`).
- The backend work item with the same number owns storage, scanning and the real atomic write.

## Privacy boundaries

- Attachments are references only; file bytes are never read here. Access is deny by default and requires a clean scan.
- Preflight messages name the rule, never the private value that failed it.
- Submission outcomes carry ids and versions only. Do not log answers or attachment names.

## Rollout and rollback

- Nothing is wired into a page yet, so merging changes no behaviour. Rollback is reverting the commit.
- When pages are added, ship behind a flag per call so existing calls keep their current form.

## Not covered here

- UI screens, API client calls, analytics events, keyboard and screen-reader testing, responsive checks and end-to-end journeys are not part of this change.
