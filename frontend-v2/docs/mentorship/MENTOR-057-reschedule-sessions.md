# MENTOR-057: Reschedule mentorship sessions

Issue: #1304. Track: Scheduling. Repository: `chainVerse-frontend` (`frontend-v2`).

## Scope

A participant asks to move a booked session, the other participant approves,
and the session moves. A coordinator or administrator can also apply a change
directly. Everything builds on the shared primitives from MENTOR-056.

- `src/features/mentorship/sessions/session-reschedule.ts` is the pure logic:
  `previewRescheduleConsequences`, `proposeReschedule`, `decideReschedule`,
  `applyReschedule`, `redactProposalFor` and the calendar reconciler.
- `session-reschedule.service.ts` is the typed API client and analytics.
- `components/RescheduleSessionPanel.tsx` is the responsive, accessible panel.
- `session-core.ts` gains the session time history, the request type, the new
  error codes and the reschedule event types.

## Flow

1. **Request.** A mentor or mentee picks a new time, gives a reason and, if a
   fee applies, confirms the fee they were shown. The session does not change.
2. **Approval.** Only the other participant can approve or decline. The
   requester can withdraw. A request expires after the policy TTL.
3. **Apply.** On approval the session moves, its revision goes up by one, the
   move is added to its history and one `mentorship.session.rescheduled` event
   is emitted.
4. **Direct change.** A coordinator or administrator can apply a change without
   approval. A reason is mandatory, the change is recorded as an override, and
   no fee is charged.

Requesting while an earlier request is still pending replaces it: the earlier
one becomes `superseded` and can no longer be approved.

## Notice policy and payment preview

`ReschedulePolicy` has two thresholds, measured from now to the session's
current start.

| Notice | Participant | Fee |
| --- | --- | --- |
| below `minNoticeHours` | refused, `RESCHEDULE_NOTICE_VIOLATION` | none |
| below `freeNoticeHours` | allowed | `lateFeeBps` of the session amount, mentee only |
| at or above `freeNoticeHours` | allowed | none |

- Mentors and coordinators are never charged. Coordinators are exempt from the
  minimum notice because they own the policy.
- The panel shows the fee and the working before the request is sent, and a
  mentee must tick a confirmation. The request carries
  `acknowledgedFeeMinor`. The same function computes the real fee, so if the
  fee changed in between, for example because the clock crossed the free
  window, the request fails with `PAYMENT_PREVIEW_MISMATCH` instead of
  charging an amount the user did not see.
- Amounts are integers in minor units and the fee is rounded once, so there is
  no floating point drift. The settlement service must apply the same rounding.

## Original time stays traceable

`originalStartsAt` is set at booking and never changes. Every applied move is
appended to `timeChanges` with the previous and new time, who asked, who
approved, the reason and whether it was an override. The panel shows the
original time and the full history, and the list always chains: each entry
starts where the last one ended.

## Stale approvals fail

An approval is valid only for the exact session state the request was made
against. It fails when:

- the session revision changed, for example after a coordinator moved it
  (`PROPOSAL_STALE`);
- the session was cancelled (`PROPOSAL_STALE`);
- the request was replaced by a newer one (`PROPOSAL_STALE`);
- the TTL has passed, the deadline instant included (`PROPOSAL_EXPIRED`);
- the request was already answered the other way (`PROPOSAL_NOT_PENDING`).

At approval the new time is checked again for lead time and for conflicts with
other sessions of either participant, so a slot taken in the meantime returns
`SLOT_CONFLICT` rather than double booking. The session being moved never
conflicts with itself.

## Repeated requests are safe

- A request is keyed by `Idempotency-Key`, scoped to the actor and the
  session. A repeat returns the original request with `replayed: true`, mints
  no second event and creates nothing new. The same key with a different time,
  reason or fee returns `IDEMPOTENCY_KEY_REUSED`.
- Approving, declining or withdrawing the same request twice returns the same
  result with no second effect. Answering the other way after it was answered
  is `PROPOSAL_NOT_PENDING`.
- The panel keeps one key per set of details. A retry after a network failure
  reuses it, and changing the time, reason or fee starts a new request.
- Event ids include the request id, so two different requests made against the
  same session revision never collide and a retry always reproduces the same
  id.

## Notifications

Three canonical events drive notifications to the other participant and to
coordinators:

- `mentorship.session.reschedule_proposed`
- `mentorship.session.rescheduled`, with the previous start
- `mentorship.session.reschedule_closed`, with `outcome` `declined` or
  `withdrawn`

Events carry identifiers and times only. They never carry the reason.

## Calendar convergence

`applyCalendarUpdate` applies a session's calendar entry only when its revision
is higher than the one already held. Duplicated, stale and out-of-order
deliveries therefore converge on the entry with the highest revision. A test
applies updates in every order, with a duplicate, and asserts one final state.
Calendar integrations must apply the same rule.

## Authorisation

Deny by default. Requesting needs the mentor or mentee of the session in the
same tenant. Answering needs the other participant. Direct changes need a
coordinator or administrator of the tenant. An unknown session or request id is
reported as `NOT_AUTHORIZED`, exactly like a forbidden one, so ids cannot be
probed.

## Privacy boundaries

- The reason is visible to both participants and to coordinators of the tenant.
  `redactProposalFor` blanks it for everyone else in the tenant and hides the
  request from other tenants entirely. The caller must redact before sending
  data to a viewer.
- Events and analytics never contain the reason, only ids, times and outcomes.
- Analytics uses an opaque actor key and counts each fact once.

## Dependencies

- **Backend/API** must implement:
  - `POST /mentorship/sessions/{sessionId}/reschedule-requests`
  - `POST /mentorship/sessions/{sessionId}/reschedule` (coordinators and
    administrators)
  - `POST /mentorship/reschedule-requests/{requestId}/{approve|decline|withdraw}`
  honour `Idempotency-Key`, run the checks above in the same transaction as
  the write, and emit the events once.
- **Payments** (MENTOR-083 and settlement) must accept the late fee from an
  approved request and never from a declined, withdrawn or expired one.
- **Calendar sync** (MENTOR-054) must apply the revision rule above.
- **Slot search** (MENTOR-055) supplies candidate times, which are rechecked at
  request and at approval.
- **Mobile** must use the same notice thresholds, fee rounding, staleness rules
  and idempotency behaviour.
- Corresponding MENTOR-057 work: the backend, smart-contract and mobile
  repositories each carry an item with the same identifier in the Scheduling
  track. This repository implements only the frontend part.

## Rollout

1. Deploy the endpoints behind a flag with the approval TTL and the fee policy
   configured per program.
2. Run in a staging cohort and verify DST weeks, requests that cross the free
   notice boundary, two participants answering at once and a coordinator
   change racing an approval.
3. Enable requests and approvals first, then direct coordinator changes.
4. Monitor `PAYMENT_PREVIEW_MISMATCH`, `PROPOSAL_STALE`, `PROPOSAL_EXPIRED`,
   `SLOT_CONFLICT` at approval and the replay rate.
5. Confirm the calendar and settlement consumers receive each event once before
   removing the flag.

## Tests

- `session-reschedule.test.ts` covers the fee preview boundaries, request
  validation, authorisation, notice and fee acknowledgement, conflicts,
  idempotency, supersession, approval, decline and withdrawal, staleness,
  expiry, rechecks at approval, repeated answers, direct changes, the history
  chain, reason visibility and calendar convergence over every delivery order.
- `session-reschedule.service.test.ts` covers the endpoints, the header and
  the analytics rules.
- `__tests__/RescheduleSessionPanel.test.tsx` covers every state, the fee
  confirmation, the approver flow, expiry, the coordinator flow, retry key
  reuse, duplicate submit protection, keyboard only completion and labelling.
