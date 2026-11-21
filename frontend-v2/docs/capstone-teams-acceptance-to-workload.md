# Capstone teams: acceptance, roles, conflicts, workload (CAPSTONE-043 to 046)

Logic modules under `frontend-v2/src/features/capstone/`. They are pure and hold no network or UI code.

| Work item | Module | What it does |
| --- | --- | --- |
| CAPSTONE-043 | `team-acceptance.ts` | Member and supervisor approvals on current terms, capacity held before activation |
| CAPSTONE-044 | `project-roles.ts` | Standard and custom roles, responsibilities, deny-by-default permission scopes |
| CAPSTONE-045 | `conflict-of-interest.ts` | Ties between team members, supervisors and reviewers, with a clear, review or blocked decision |
| CAPSTONE-046 | `workload-limits.ts` | Concurrent projects, weekly hours, team size and supervision caps including pending reservations |

## Dependencies

- Supervisor eligibility and capacity data come from `supervisor-eligibility.ts` and `call-capacity.ts`; this change reads no data itself.
- `reviewer-assignments.ts` should call `findReviewerConflicts` before assigning; that wiring is not part of this change.
- The backend work item with the same number owns the real atomic reservation.

## Privacy boundaries

- Conflict results name the kind of tie only. Do not log the relationship detail.
- Workload messages show limits and totals, not the other projects' names.

## Rollout and rollback

- Nothing is wired into a page yet, so merging changes no behaviour. Rollback is reverting the commit.

## Not covered here

- UI screens, API calls, analytics, keyboard and screen-reader testing, responsive checks and end-to-end journeys.
