# MENTOR-055: Find mutually available session slots

## Scope

`src/features/mentorship/availability/slot-finder.ts` computes candidate session
slots by intersecting every participant's weekly availability after applying:

- each participant's IANA time zone;
- program duration and optional lead time;
- pre/post-session buffers around existing bookings;
- program and participant blackout periods;
- existing bookings counted against program capacity;
- a deterministic slot granularity.

Each candidate carries its UTC start/end and remaining capacity.
`slot-finder.service.ts` is the typed API client and
`components/MutualSlotFinder.tsx` is the responsive, accessible result list.

## Determinism and DST

- Weekly windows are wall-clock times in each participant's time zone. The
  conversion to UTC happens per occurrence, so local start times stay stable
  across spring-forward and fall-back.
- Non-existent spring-forward local times are skipped. Ambiguous fall-back times
  resolve to the first occurrence.
- Candidates are generated in ascending start order with a fixed granularity.
  The same inputs in any order produce the same page.
- Intersections and blackout subtraction are half-open (`[start, end)`), so
  adjacent windows merge without overlap.

## Capacity and bookings

- Program `capacity` is the number of simultaneous sessions a candidate can
  hold. Overlapping bookings reduce `availableCapacity`; candidates with no
  remaining capacity are omitted.
- `bufferBeforeMinutes` and `bufferAfterMinutes` expand each existing booking
  when checking overlap, so a new session never starts or ends inside another
  session's buffer.
- `leadTimeMinutes` removes candidates that start too soon, and past candidates
  are never returned.

## Pagination and stale candidates

- Results are keyed by candidate start time. `limit` is capped at 100 and the
  response carries `nextCursor`/`total`; an unknown cursor returns
  `INVALID_PAGE`.
- A selected candidate must be revalidated at booking time with
  `revalidateSessionSlot`. Revalidation recomputes the slot from current
  availability, bookings and blackouts. A slot that disappeared returns
  `SLOT_STALE` (HTTP 410) rather than being booked from cached data.
- Search is read-only, so repeated searches produce no side effects. The booking
  API must still enforce idempotency on the final booking request.

## Authorization and privacy

Authorization is deny-by-default. A search is allowed only when the actor's
tenant matches the program tenant and the actor is either a program participant
or a coordinator/administrator. Other mentors, mentees and tenants receive
`NOT_AUTHORIZED`.

The frontend only returns slot times and capacity. It never returns another
participant's raw calendar, booking identifiers, event content or exception
reasons. The API remains the authority for authorization and must re-run the
same checks.

## Dependencies

- **Backend/API** must implement:
  - `GET /mentorship/programs/{programId}/slots?rangeStart=&rangeEnd=&limit=&cursor=`
  - `POST /mentorship/programs/{programId}/slots/revalidate`
- The backend owns participant availability, external free/busy data, booking
  records, blackout periods, program capacity and lead-time configuration.
- **Contracts** own the program duration, capacity and buffer semantics mirrored
  here.
- **Booking service** must call revalidation immediately before committing a
  booking and enforce idempotency so retries do not create duplicate sessions.
- **Mobile** must use the same half-open interval, DST and capacity rules.

## Rollout

1. Deploy the slot-search and revalidation endpoints with authorization and
   capacity enforcement.
2. Enable search in a staging cohort and verify DST weeks, cross-time-zone
   programs, blackouts and buffer behaviour.
3. Shadow-run revalidation against production bookings before allowing booking
   from search results.
4. Roll out to mentors/mentees, then coordinators and administrators. Monitor
   `NOT_AUTHORIZED`, `SLOT_STALE`, empty-result rates and pagination depth.
5. Keep search results short-lived; never persist candidates as booking
   authority.

## Tests

`slot-finder.test.ts` covers intersection, time zones, spring-forward and
fall-back, non-existent local times, blackouts, buffers, capacity, lead time,
pagination, authorization, validation and revalidation. The component tests
cover rendering, capacity labels, search, selection by mouse and keyboard, load
more, loading/empty/error/denied states and action failures.
