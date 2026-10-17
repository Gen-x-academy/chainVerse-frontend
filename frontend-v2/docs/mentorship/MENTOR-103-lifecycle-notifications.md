# MENTOR-103 — Reliable lifecycle notifications

Closes #1350. Shared work item: **MENTOR-103** (Communication track).

## Scope

Important mentorship transitions enqueue localized notifications into an outbox
instead of calling a provider inline, so domain commits never depend on provider
uptime.

## Behaviour

- **Deduplication** — `dedupeKey` is `eventId:recipientId:channel`, guaranteeing
  at most one send per channel policy even across retries.
- **Retries** — transient failures increment `attempts` and schedule the next
  attempt with exponential backoff from `BASE_BACKOFF_MS`.
- **Dead-letter** — once `maxAttempts` is reached the entry moves to
  `dead_letter` with `lastError`, remaining observable without blocking others.
- **Localization** — each entry carries a `locale`; templates are resolved by
  locale at send time.
- **Safe data** — `assertSafePayload` rejects payloads containing sensitive keys
  before they can reach a provider.

## APIs

`enqueue`, `dueEntries`, `markSent`, `markFailed`, `processOutbox`,
`assertSafePayload`.

## Dependencies & privacy

- Provider adapters implement the `OutboxSender` contract; delivery is injected,
  keeping this module provider-agnostic and unit-testable.
- Payloads must not include secrets, identity refs, or precise locations.

## Rollout

Enable the outbox drain worker before switching transitions to enqueue-only.
Monitor `dead_letter` counts and alert on growth.

## Tests

`npx vitest run src/features/mentorship/__tests__/notification-outbox.test.ts`
covers dedupe, localization, unsafe payloads, backoff, dead-letter, and idempotent
draining.

## Related MENTOR-103 work

Backend provides the outbox store, provider adapters, and drain scheduler.
