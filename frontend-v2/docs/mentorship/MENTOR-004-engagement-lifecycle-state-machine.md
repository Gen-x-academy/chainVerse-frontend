# MENTOR-004: Engagement lifecycle state machine

| Field | Value |
| --- | --- |
| Work item | MENTOR-004 |
| Issue | #1251 |
| Owner | Memplethee-lab |
| Depends on | MENTOR-001 (lifecycle table), MENTOR-003 (roles) |

## Scope

Defines and enforces a guarded, auditable state machine for engagements, built
directly on the canonical engagement lifecycle table in `glossary.ts`
(MENTOR-001). The glossary stays the single source of truth; this module turns
the table into an application step with an audit trail.

## Guarantees

1. **Validation first.** Every transition is evaluated with
   `evaluateMentorshipTransition('engagement', ...)` before anything is
   applied. Illegal jumps and unknown states are rejected with the glossary's
   stable error codes (`ILLEGAL_TRANSITION`, `UNKNOWN_STATE`).
2. **Complete audit records.** Each applied transition appends
   `{ from, to, actorId, actorRole, reason, occurredAt }` to the engagement
   history, so every state change names the prior state, who moved it, why,
   and when.
3. **Idempotent retries.** Re-applying a transition to the status the
   engagement is already in is a no-op: the record is returned unchanged and
   no duplicate history entry is written.
4. **Reason discipline.** `withdrawn`, `cancelled`, and `disputed` always
   require a non-empty reason, checked before any write.

## Module

`src/features/mentorship/engagements/lifecycle-state-machine.ts`

- `applyEngagementTransition(engagement, to, context)` -> outcome with the
  updated engagement or a typed failure (`UNKNOWN_STATE`,
  `ILLEGAL_TRANSITION`, `REASON_REQUIRED`).
- `allowedEngagementTransitions(status)` - canonical outgoing states, used to
  render transition actions and to document terminal states.
- `isTerminalEngagementState(status)` - reuses the glossary concept of a
  terminal state.
- `EngagementTransitionRecord`, `EngagementWithHistory` - the audit-friendly
  engagement shape.

## Authorization

Who may move an engagement follows the MENTOR-003 matrix: the `engagement`
resource grants `update` to `mentor` and `organization-staff`, and full
management to `administrator`. The client renders nothing it cannot execute;
the API re-enforces the same grants and self-approval rules.

## Tests

`engagements/__tests__/lifecycle-state-machine.test.ts` covers the happy path,
illegal jumps, unknown states, idempotent no-ops, audit record shape, the
reason requirement on destructive targets, and the canonical transition lists
for every demo status.

## Dependencies

- Backend/API must expose `/mentorship/engagements/:id/transitions` and apply
  the same table + audit shape server-side.
- Contracts (MENTOR-006) validate `engagement.transition` envelopes against
  this machine's vocabulary.
- Companion flows (`pause-resume.ts`, `complete-terminate.ts`) extend specific
  targets of the same table; this module is the generic application step.
