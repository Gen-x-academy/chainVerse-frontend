# MENTOR-056: Book mentorship sessions

Issue: #1303. Track: Scheduling. Repository: `chainVerse-frontend` (`frontend-v2`).

## Scope

A session is booked from an **active** agreement. The request carries the
participants, start time, duration, mode, an optional location reference, an
optional agenda and an idempotency key.

- `src/features/mentorship/sessions/session-core.ts` holds the shared
  scheduling primitives: types, the stable error table, the canonical event,
  the ledger, deny-by-default authorisation and local-plus-UTC formatting. The
  reschedule, cancel and no-show work reuses it.
- `session-booking.ts` is the pure booking logic (`bookSession`).
- `session-booking.service.ts` is the typed API client and analytics.
- `components/SessionBookingForm.tsx` is the responsive, accessible form with
  explicit empty, denied, loading, error and success states.

## Booking rules

`bookSession` applies the checks in a fixed order. The API must mirror it.

1. **Authorisation, deny by default.** The actor must be in the agreement's
   tenant and be its mentor, its mentee, or a coordinator or administrator.
   Anything else returns `NOT_AUTHORIZED` and reveals nothing else.
2. **Active agreement.** Draft, pending and superseded agreements return
   `AGREEMENT_NOT_ACTIVE`.
3. **Idempotency.** See below.
4. **Validation.** Participants must be the agreement parties. Duration must be
   one the program allows. In-person and hybrid sessions need a location
   reference. The agenda is plain text up to 2000 characters. All problems are
   returned together as `INVALID_SESSION` issues.
5. **Lead time.** A start inside the policy lead time returns
   `LEAD_TIME_VIOLATION`.
6. **Conflict check.** Any booked session that shares either participant and
   overlaps the new session (plus the buffer) returns `SLOT_CONFLICT`.

## Double booking and concurrency

The conflict check is the only guard against double booking, so it must run
inside the same transaction that writes the session. In this module the
`SessionLedger` is that serialisation point: requests are applied one after
another and each sees the result of the previous one. In a test that fires 25
requests for the same slot, exactly one succeeds, 24 get `SLOT_CONFLICT`, and
the ledger holds one session and one event.

Intervals are half open, so a session that starts the moment another ends does
not conflict unless a buffer is configured. Cancelled sessions never block.

The server needs a database level guarantee as well, for example an exclusion
constraint on `(participant, time range)` for booked sessions, because the
frontend check cannot protect against two API nodes.

## Idempotency

- One key per user intent. The form generates it on the first submit and reuses
  it for every retry of the same details, including after a network failure.
  Changing any field starts a new intent with a new key.
- The key is sent in the body and in the `Idempotency-Key` header.
- A repeat of the same intent returns the original session with
  `replayed: true` and creates no new session and no new event. A replay still
  succeeds after the lead time has passed.
- The same key with different details returns `IDEMPOTENCY_KEY_REUSED`.
- Keys are scoped to the actor and the agreement, so a participant cannot use a
  key to read the other participant's booking.
- The display time zone is not part of the intent: it only affects rendering.

## One canonical event

A successful booking produces exactly one `mentorship.session.booked` event.
Its id is derived from the event type, the session and its revision, so a retry
cannot mint a second event and consumers can dedupe on it. A replay returns no
event. Analytics follows the same rule and counts only first-time bookings.

## Time display

The confirmation always shows the viewer's local time with its zone
abbreviation and the same range in UTC, so participants in different zones can
confirm they agree on the instant. An unrecognised zone falls back to UTC
rather than throwing.

## Errors

Errors have stable codes, HTTP statuses and messages that name the next step.
They never contain identifiers, names or free text. The client maps a JSON
response body carrying a known `code` onto the table and treats anything else
as the retryable `UNKNOWN` failure.

| Code | Status | Retry unchanged |
| --- | --- | --- |
| `NOT_AUTHORIZED` | 403 | no |
| `AGREEMENT_NOT_ACTIVE` | 409 | no |
| `INVALID_SESSION` | 422 | no |
| `INVALID_TIME_ZONE` | 422 | no |
| `LEAD_TIME_VIOLATION` | 422 | no |
| `SLOT_CONFLICT` | 409 | no |
| `IDEMPOTENCY_KEY_INVALID` | 400 | no |
| `IDEMPOTENCY_KEY_REUSED` | 422 | no |
| `UNKNOWN` | 500 | yes |

## Role-aware navigation

`MentorshipArea` gains a `sessions` area. Students, mentors, organisation staff
and administrators can reach it. Guardians, finance, moderators and tutors
cannot, because none of them has a scheduling duty. `toSchedulingRole` maps a
mentorship role onto a scheduling role and returns nothing for roles without
one, which the logic treats as unauthorised.

## Privacy boundaries

- The location is an opaque reference to a stored record, never a free-text
  address. The agenda is plain text and is stored with the session only.
- The canonical event and analytics carry identifiers and times only. They
  never carry the agenda or the location reference.
- Analytics uses an opaque actor key and never a user id, email or name.
- Authorisation failures return a generic error with no detail about the
  agreement or the other participant.

## Dependencies

- **Backend/API** must implement
  `POST /mentorship/agreements/{agreementId}/sessions` with the request and
  response shapes in `session-booking.service.ts`, honour the
  `Idempotency-Key` header, enforce the conflict check transactionally, and
  emit one `mentorship.session.booked` event per new booking.
- **Slot search** (MENTOR-055) supplies the candidate. The booking service must
  revalidate it, as the slot finder documents, immediately before committing.
- **Agreements** (MENTOR-045, MENTOR-046) own the `active` state.
- **Contracts** own the session, mode, duration and buffer vocabulary mirrored
  here.
- **Mobile** must use the same half-open overlap rule, the same idempotency
  behaviour and the same local-plus-UTC confirmation.
- Corresponding MENTOR-056 work: the backend, smart-contract and mobile
  repositories each carry an item with the same identifier in the Scheduling
  track. This repository implements only the frontend part.

## Rollout

1. Deploy the booking endpoint behind a flag, with the exclusion constraint and
   idempotency store in place.
2. Enable it for a staging cohort. Verify DST weeks, participants in different
   zones, retries after timeouts and two clients racing for one slot.
3. Shadow the conflict check against production data before enabling writes.
4. Roll out to mentors and mentees, then to coordinators and administrators.
   Monitor `SLOT_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`, `LEAD_TIME_VIOLATION`
   and the replay rate.
5. Keep the flag until the canonical event is confirmed to reach settlement and
   notification consumers exactly once.

## Tests

- `session-booking.test.ts` covers authorisation, agreement state, validation,
  lead time, conflicts and buffers, a 25-way race, idempotency, time
  rendering, the error table and role mapping.
- `session-booking.service.test.ts` covers the request, the header and the
  analytics rules.
- `__tests__/SessionBookingForm.test.tsx` covers every state, keyboard only
  completion, labelling and descriptions, focus handling, retry key reuse and
  duplicate submit protection.
- `test-fixtures.ts` holds the fixed instants and identifiers. It is test-only.
