# Capstone planning: schedule risks, milestones, check-ins, risk register (CAPSTONE-059 to 062)

Logic modules under `frontend-v2/src/features/capstone/`. They are pure and hold no network or UI code. Each module is self-contained.

| Work item | Module | What it does |
| --- | --- | --- |
| CAPSTONE-059 | `schedule-risks.ts` | Rejects dependency cycles; reports impossible dates, blocked critical paths, resource conflicts and deadline risk |
| CAPSTONE-060 | `project-milestones.ts` | Ordered milestones with due dates, dependencies, reviewer, deliverables, completion rules and funding link |
| CAPSTONE-061 | `progress-checkins.ts` | Append-only objective check-ins with status, confidence, blockers, evidence and next actions |
| CAPSTONE-062 | `project-risks.ts` | Risk register with scoring, owner, mitigation, contingency, review dates, history and scoped visibility |

## Dependencies

- `schedule-risks.ts` takes generic scheduled items. The existing work breakdown module (`work-breakdown.ts`, CAPSTONE-058) leaves cycle checks to this one, so its tasks can be mapped onto `ScheduledItem` by the caller. That mapping is not part of this change.
- Milestone funding links use tranche ids supplied by the caller; the funding modules are separate work items.
- The backend work item with the same number owns stored records and real atomic writes.

## Privacy boundaries

- Risks about people, funding or ethics cannot be team-visible; `validateRisk` enforces this and `canView` denies by default.
- Check-in summaries, blockers and risk text are free text. Keep them out of logs and analytics.
- Evidence is held as references only.

## Rollout and rollback

- Nothing is wired into a page yet, so merging changes no behaviour. Rollback is reverting the commit.

## Not covered here

- UI screens (timeline, check-in forms, risk matrix), API calls, analytics, keyboard and screen-reader testing, responsive checks and end-to-end journeys.
