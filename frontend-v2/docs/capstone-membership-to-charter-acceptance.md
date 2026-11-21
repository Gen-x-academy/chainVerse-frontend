# Capstone membership and charters (CAPSTONE-047 to 050)

Logic modules under `frontend-v2/src/features/capstone/`. They are pure and hold no network or UI code.

| Work item | Module | What it does |
| --- | --- | --- |
| CAPSTONE-047 | `membership-changes.ts` | Join, leave, removal, role change and substitution with effective dates and an append-only log |
| CAPSTONE-048 | `team-rematching.ts` | Rematch request states: review, successor invites, continuity plan, consent |
| CAPSTONE-049 | `project-charters.ts` | Charter sections, accepted term versions, sealing, canonical text and SHA-256 hash |
| CAPSTONE-050 | `charter-acceptance.ts` | Approval records with actor, hash, version, timestamp, expiry and single-use nonce |

## Dependencies

- Role keys follow `project-roles.ts` (CAPSTONE-044, separate pull request). Only the `lead` key is assumed here.
- Acceptance takes a sealed charter reference (id, version, hash) from `project-charters.ts`.
- The backend work item with the same number owns the real atomic writes and nonce store.

## Privacy boundaries

- Acceptance records hold the charter hash, not the text.
- Removal reasons and rematch notes are free text. Treat them as private: do not log them or put them in analytics.

## Rollout and rollback

- Nothing is wired into a page yet, so merging changes no behaviour. Rollback is reverting the commit.

## Not covered here

- UI screens, API calls, analytics, keyboard and screen-reader testing, responsive checks and end-to-end journeys.
- `charterHash` uses Web Crypto, which is available in current browsers and Node 20.
