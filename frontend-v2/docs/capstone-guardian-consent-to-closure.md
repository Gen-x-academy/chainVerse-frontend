# Capstone guardian consent, amendments, pause, closure (CAPSTONE-051 to 054)

Logic modules under `frontend-v2/src/features/capstone/`. They are pure and hold no network or UI code. Each module is self-contained so it does not depend on the other capstone pull requests.

| Work item | Module | What it does |
| --- | --- | --- |
| CAPSTONE-051 | `guardian-consent.ts` | Scoped, expiring, revocable guardian consent held as a verified relationship reference; re-consent after material change |
| CAPSTONE-052 | `charter-amendments.ts` | Versioned amendments with impact preview, required approvals, effective date and immutable earlier versions |
| CAPSTONE-053 | `project-pause.ts` | Policy-limited pauses with reasons, dates, deadline and funding impact, approval rules, expiry and safe resume |
| CAPSTONE-054 | `project-closure.ts` | Completion, mutual termination, inactivity, policy action and sponsor withdrawal with structured outcomes |

## Dependencies

- The charter shapes in `charter-amendments.ts` are deliberately generic (section name to text). They line up with the charter module in the CAPSTONE-049 pull request but do not import it.
- `project-pause.ts` takes team and charter facts as inputs (`resumeBlockers`), so it works with the membership and acceptance modules without importing them.
- The backend work item with the same number owns the stored records and real atomic writes.

## Privacy boundaries

- Guardian consent stores an opaque relationship reference only. Never add a guardian name, email or document to these records or to logs.
- Closure summaries and pause notes are free text and may be private. Keep them out of logs and analytics.

## Rollout and rollback

- Nothing is wired into a page yet, so merging changes no behaviour. Rollback is reverting the commit.

## Not covered here

- UI screens, API calls, analytics, keyboard and screen-reader testing, responsive checks and end-to-end journeys.
- Age-of-majority is a parameter (default 18); per-region rules are not modelled.
