# MENTOR-053: Manage recurring mentor availability

## Scope

`src/features/mentorship/availability/recurring-availability.ts` models a
mentor's repeating weekly availability in an IANA time zone, together with
date-specific exceptions, an effective range and booking policy.

The schedule contains:

- weekly windows (`dayOfWeek`, local `start`, local `end`);
- exceptions that add (`available`) or remove (`unavailable`) availability on a
  local calendar date;
- an effective range (`effectiveFrom`, optional `effectiveUntil`);
- lead time, pre/post-session buffers and a booking horizon.

`recurring-availability.service.ts` is the typed API client.
`components/RecurringAvailabilityPanel.tsx` is the responsive editor with
explicit empty, loading, success and error states, labelled native controls and
an `aria-live`-friendly success/error presentation.

## Time zone and DST rules

- Weekly windows are wall-clock times in the schedule's IANA time zone, not UTC.
- `expandAvailability` converts local times to UTC per occurrence. A 09:00 New
  York window therefore moves by one hour in UTC across spring-forward and
  fall-back, while remaining 09:00 locally.
- Spring-forward gaps (for example 02:30 in `America/New_York` on the transition
  day) do not exist. That occurrence is skipped rather than shifted into an
  unintended hour.
- Ambiguous fall-back times resolve to the first occurrence, so repeated
  expansions are deterministic.
- Invalid time zones, malformed times, inverted windows and inverted effective
  ranges fail with stable issue codes before any expansion occurs.
- A weekly window must end after it starts on the same local day. Overnight
  availability is expressed as two windows (for example 23:00-23:59 and
  00:00-01:00) rather than one window that crosses midnight.

## Normalization and exceptions

Weekly windows are always sorted by weekday, then start, then end. Overlapping
and adjacent windows on the same day are merged deterministically. The same
input in any order produces the same normalized schedule.

Exceptions are applied per local date after the weekly pattern. Added windows
are merged into the day's slots; unavailable windows are subtracted from them.
A full-day unavailable exception clears the day. Unavailable exceptions take
precedence over added exceptions, so an accidental gap cannot be overridden by
an addition.

## Booking policy

- `leadTimeMinutes` is the minimum notice before a slot can be booked.
- `bufferBeforeMinutes` and `bufferAfterMinutes` shrink the bookable portion of
  a slot.
- `bookingHorizonDays` caps how far ahead a slot may start.

`applyBookingPolicy` returns only the slots that remain bookable at `now`.

## Existing bookings

`findBookingConflicts` checks existing bookings against the new schedule and
reports every booking the schedule would no longer cover. It never edits a
booking. `updateRecurringAvailability` refuses to save when conflicts exist
unless the caller explicitly sets `acknowledgeConflicts`; even then the
conflicts are returned so the UI can warn the mentor and arrange a reschedule.

Optimistic versions are enforced: the next schedule must carry a higher version
than the current one, so a stale editor cannot overwrite a newer schedule.

## Privacy

The schedule contains no participant personal data beyond the mentor and their
availability. Internal reasons on exceptions are optional and are not required
for expansion. Exports or previews must only expose slots, never private notes
or booking details. The API remains the authority for authorization; the
frontend guard only prevents an unusable UI.

## Dependencies

- **Backend/API** must implement:
  - `GET /mentorship/availability/recurring/{mentorId}`
  - `PUT /mentorship/availability/recurring/{mentorId}`
  - `GET /mentorship/availability/recurring/{mentorId}/preview?from=&to=`
- Update requests carry `expectedVersion`, `idempotencyKey` and an optional
  `acknowledgeConflicts` flag. The API must re-run authorization, version,
  idempotency and booking-conflict checks.
- **Contracts** own the canonical schedule shape and time-zone semantics. The
  frontend mirrors them; a field rename is a breaking change.
- **Mobile** must use the same wall-clock/DST rules and the same
  unavailable-overrides-available precedence.
- **Booking service** must treat the returned conflicts as a hard stop until the
  mentor or coordinator explicitly reschedules affected bookings.

## Rollout

1. Deploy the API endpoints with version and idempotency enforcement.
2. Enable the editor for a staging cohort and verify DST transitions with short
   effective ranges.
3. Shadow-run conflict detection against production bookings before enabling
   saves.
4. Roll out to mentors, then coordinators. Monitor validation failures, conflict
   acknowledgements and stale-version responses.
5. Retain the previous schedule version for audit and rollback according to the
   platform retention policy.

## Tests

`recurring-availability.test.ts` covers validation, deterministic
normalization, spring-forward and fall-back transitions, non-existent local
times, ambiguous local times, exceptions, effective ranges, booking policy,
conflict detection and version protection. The component tests cover rendering,
normalization on save, validation feedback, save failures, denied permissions
and keyboard submission.
