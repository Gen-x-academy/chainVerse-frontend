# Scholarship notification events (closes #1139)

## What this is

A typed event vocabulary for everything the platform tells a scholarship
participant about, and a single pure decision function that decides whether an
event is emitted, suppressed as a duplicate, or rejected.

- Event names: `deadline.approaching`, `application.action-required`,
  `review.assigned`, `decision.recorded`, `award.acceptance-required`,
  `milestone.evidence-required`, `payment.processed`, `payout.setup-required`.
- Channels: `in-app`, `email`, `sms`, `push`.
- Module: `src/features/scholarships/notification-events`.
- Route: `/scholarships/notifications/events`.
- API base path: `/scholarships/notifications/events`.

Every event carries `eventId`, `version`, `occurredAt`, `correlationId`, a
`subject` **reference**, `channel`, `recipientRef`, `mandatory`, a filtered
`payload`, and an `idempotencyKey` derived from
`idempotencyKeyFor(name, subject, occurredAtBucket)`.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Emitters:** the workflow modules that own each fact (deadline scheduler,
  review assignment, decision recorder, payments).
- **Review ownership:** a change to `PAYLOAD_ALLOWLIST` or to
  `MANDATORY_NOTIFICATION_EVENTS` needs a privacy review, because the first
  widens what a channel can read and the second narrows what a recipient can
  opt out of.

## Privacy

**No PII is emitted in event payloads.** Specifically:

- A `NotificationSubject` is a stable reference (`kind` + `id`), never a name,
  email address, or free text.
- `recipientRef` is an opaque reference, not a contact detail.
- The payload is filtered through `PAYLOAD_ALLOWLIST` per event name before the
  event is stored: `stripToAllowlist` copies only the allowlisted keys, so
  extra keys are removed rather than passed to the channel. There is no
  emit-then-hide path.
- `isPiiField(key)` flags `name`, `email`, `phone`, `address`, `essay`,
  `dateOfBirth`, `ssn`/`taxId`, `transcript`/`gpa`, and `notes`/`freeText`
  patterns; tests assert that no surviving payload key matches any of them.
- `validatePayload` reports `missing` and `stripped` keys so the log can show
  exactly what was removed on every emission.
- The payload-inspection view in `ScholarshipNotificationEventLog` exists to
  make this auditable: it lists the allowlist for every event name and never
  renders an applicant name, an email address, or essay text.

## Migration

- Additive only: new self-contained module, new route, and
  `src/features/scholarships/events.ts` / `index.ts` are untouched. This
  vocabulary complements (it does not replace) the transactional outbox events
  in `events.ts`; the two are linked by `correlationId`.
- Emission is deterministic. `emitNotificationEvent(draft, preferences, sent,
  now)` takes every input, including the current time, so a retry of the same
  fact produces the same `idempotencyKey` and is suppressed rather than
  delivered twice. `Date.now()` is never called inside a pure function.
- A **mandatory** event ignores channel preferences and emits with
  `MANDATORY_OVERRIDES_PREFERENCE`; a non-mandatory event on an opted-out
  channel is rejected with `PREFERENCE_SUPPRESSED`; an event whose payload
  cannot satisfy its channel is rejected with `INSUFFICIENT_PAYLOAD`.

## Operational impact

- Fails softly: a failed list request renders a `role="alert"` panel, and the
  simulate control is entirely client-side so it cannot fan out real messages.
- Exactly-once delivery is a property of `idempotencyKey`; the backend must
  enforce uniqueness, and the client treats a `409` as a duplicate rather than
  an error.
- Metrics to watch: `duplicate-suppressed` ratio (a spike means a workflow is
  retrying, not that users are double-notified), `INSUFFICIENT_PAYLOAD` count
  (an emitter is missing allowlisted keys), and
  `MANDATORY_OVERRIDES_PREFERENCE` count (a preference matrix is out of date).

## Verify

- `npx vitest run src/features/scholarships/__tests__/notification-events.test.ts
  src/features/scholarships/notification-events` — idempotency determinism,
  duplicate suppression, mandatory override, preference suppression, payload
  stripping, and the component's table/filter/simulation/permission states.
- Manual: on `/scholarships/notifications/events`, emit `review.assigned` on
  email with the opt-in unticked (expect `PREFERENCE_SUPPRESSED`), tick it and
  emit twice (expect `emitted` then `duplicate-suppressed`), then open
  "Inspect payload" and confirm no applicant identity is listed.
