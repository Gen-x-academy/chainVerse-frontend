# MENTOR-058: Cancel mentorship sessions

Issue: #1305. Track: Scheduling. Repository: `chainVerse-frontend` (`frontend-v2`).

## Scope

A participant or a coordinator cancels a booked session. The cancellation is
priced by the program's cancellation policy, frees the slot, sends one
instruction to settlement and tells both participants what happened.

- `src/features/mentorship/sessions/session-cancellation.ts` is the pure logic:
  `previewCancellation`, `cancelSession`, `describeCancellationForParticipant`
  and `redactCancellationFor`.
- `session-cancellation.service.ts` is the typed API client and analytics.
- `components/CancelSessionPanel.tsx` is the responsive, accessible panel.
- `session-core.ts` gains the cancellation record, the settlement instruction,
  the reason codes and the `SESSION_STARTED` error.

Pricing reuses `calculateCancellation` from `payments/cancellation-refunds`.
This module adds no second set of refund rules.

## Notice calculation and fee consequence

Notice is the time from now to the session's start, in hours, never below zero.

| Who cancels | Refund to the mentee |
| --- | --- |
| mentee | the tier for the notice: the first tier whose minimum notice is met |
| mentor | full |
| coordinator or administrator | full, recorded as `platform` |

The refund, the amount paid to the mentor and the platform fee always add up to
the session amount. The panel shows the notice, the refund, its percentage and
the working before anything is sent, and the user must tick a confirmation that
names the refund. The request carries `acknowledgedRefundMinor`. The same
function prices the real cancellation, so if the refund changed in between, for
example because the clock crossed into the next tier, the request fails with
`PAYMENT_PREVIEW_MISMATCH` instead of charging an amount the user did not see.

A session that has already started cannot be cancelled (`SESSION_STARTED`). A
no-show is reported instead, which is MENTOR-059.

## Policy version is recorded

`CancellationPolicySnapshot` carries the policy, a version and the platform
fee rate. The cancellation record and the settlement instruction both store the
policy id and version that priced them. If the program changes the policy
later, an earlier cancellation keeps the version it was priced with, and a
replay returns the original record unchanged. A policy that cannot price a
refund, or a version below 1, is refused rather than guessed at.

## Idempotent, with one settlement instruction

Cancelling is idempotent in two ways.

- The same `Idempotency-Key` returns the original cancellation with
  `replayed: true`. The same key with different details returns
  `IDEMPOTENCY_KEY_REUSED`.
- Cancelling a session that is already cancelled returns the original
  cancellation whatever the key. If a mentor and a mentee cancel at the same
  moment, the first cancellation wins and the second sees it.

Neither path mints a second event or a second settlement instruction. The
instruction id is derived from the session alone, so it is the same however
many times the request is retried, and settlement can dedupe on it. A test
covers a repeat, a retry with a new key, and two participants cancelling
together, and asserts one event and one instruction each time.

## Capacity and slot reuse

The slot is freed at once: a cancelled session no longer blocks either
participant, so another booking can take it. Whether it is offered again is
still decided by the booking lead time, so a slot that starts too soon cannot
be booked again. Any pending reschedule request on the session is closed, so
it can no longer be approved, and the calendar converges on the cancelled state
through the revision rule from MENTOR-057.

## Participant communication

`mentorship.session.cancelled` is the one canonical event. It carries the
reason category, who cancelled by role and the settlement instruction id. It
never carries the note.

`describeCancellationForParticipant` builds the message each participant
receives: who cancelled, the session time in the recipient's zone and in UTC,
the reason, the note when there is one, and what it means for that recipient's
money, either the refund for the mentee or the payment for the mentor.

## Authorisation

Deny by default. The actor must be in the session's tenant and be its mentor,
its mentee, or a coordinator or administrator. An unknown session id is
reported as `NOT_AUTHORIZED`, exactly like a forbidden one, so ids cannot be
probed. The `platform_action` reason is for coordinators and administrators
only.

## Privacy boundaries

- The note is visible to both participants and to coordinators of the tenant.
  `redactCancellationFor` blanks it for everyone else in the tenant and hides
  the cancellation from other tenants entirely. The caller must redact before
  sending data to a viewer.
- Events, the settlement instruction and analytics never contain the note.
- Analytics uses an opaque actor key and counts each cancellation once.

## Dependencies

- **Backend/API** must implement
  `POST /mentorship/sessions/{sessionId}/cancellation`, honour
  `Idempotency-Key`, price with the same policy and version, write the
  cancellation, the settlement instruction and the event in one transaction,
  and release the slot in that transaction.
- **Settlement** (MENTOR-083 and the payments services) consumes the
  instruction once and dedupes on `instructionId`.
- **Reschedule** (MENTOR-057) requests are closed by a cancellation.
- **Calendar sync** (MENTOR-054) applies the revision rule.
- **Mobile** must use the same notice calculation, tier boundaries and
  idempotency behaviour.
- Corresponding MENTOR-058 work: the backend, smart-contract and mobile
  repositories each carry an item with the same identifier in the Scheduling
  track. This repository implements only the frontend part.

## Rollout

1. Deploy the endpoint behind a flag with the policy version stored on each
   program.
2. Verify in staging the tier boundaries, a mentor cancel, a coordinator
   cancel, two participants cancelling together, a cancel racing a reschedule
   approval and a retry after a timeout.
3. Reconcile settlement instructions against cancellations before enabling
   payouts from them.
4. Monitor `PAYMENT_PREVIEW_MISMATCH`, `SESSION_STARTED`, the replay rate and
   any session with more than one instruction, which must be zero.

## Tests

- `session-cancellation.test.ts` covers the notice tiers and boundaries, the
  conservation of the amount, the policy snapshot, the event, the single
  instruction, authorisation, validation, started and non-booked sessions,
  refund acknowledgement, every idempotency path, a mentor and mentee race,
  slot reuse and lead time, reschedule closure, calendar convergence, the
  participant notice and note visibility.
- `session-cancellation.service.test.ts` covers the endpoint, the header and
  the analytics rules.
- `__tests__/CancelSessionPanel.test.tsx` covers every state, the consequence
  preview, validation, confirmation, success focus, retry key reuse, duplicate
  submit protection and keyboard only completion.
