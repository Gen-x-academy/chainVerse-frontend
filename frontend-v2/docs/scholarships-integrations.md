# Scholarships contracts, idempotency and sponsor webhooks

## Overview

Three integration capabilities ship together for the scholarships domain:

- **Versioned API contracts** — stable schemas for programs, applications, reviews, awards, milestones, payments, errors, and pagination. `diffContracts` classifies every difference as compatible, additive, or breaking, and a breaking change requires a new contract version before it can ship (`issue #1161`).
- **Idempotent mutations** — submissions, decisions, acceptance, milestones, payouts, refunds, and notifications accept an idempotency key that binds the actor and the operation. Concurrent retries return the first outcome; the same key with a different payload is refused (`issue #1151`).
- **Signed sponsor webhooks** — selected program and award events are delivered to approved sponsor endpoints with signed, timestamped payloads, bounded exponential-backoff retries, replay protection, secret rotation, and visible delivery history (`issue #1163`).
- **Role-based access and tenant isolation** — student, sponsor, reviewer, verifier, finance, auditor, and administrator permissions are enforced on every resource, direct object access across users or sponsors fails, and list queries are scoped to the caller's tenant (`issue #1149`).

The operator surface lives at `/scholarships/integrations`.

## Ownership

Platform engineering owns the contract catalogue, the idempotency store, the webhook delivery
pipeline, and the role/permission matrix. The integration team owns sponsor onboarding and endpoint
allow-listing, and security engineering reviews every change to the matrix.

## Privacy

Webhook payloads contain only program and award facts required by the sponsor; applicant PII is
excluded. Signing secrets are referenced by id (`secretRef`) and never serialized to the client, and
delivery history records status codes rather than payload bodies.

## Migration

Contracts are versioned rather than edited in place: additive changes may reuse the current version,
while breaking changes must ship a new version and a migration note for consumers. Webhook consumers
should treat `signatureVersion: 'v1'` as the current scheme and must tolerate additional events being
added to a subscription.

## Role-based access and tenant isolation

`canPerform` denies access with `CROSS_TENANT_DENIED` when the principal's tenant differs from the
resource's tenant, with `NO_PERMISSION` when the role has no grant for the action, and with
`NO_PERMISSION` when a student targets another student's record. `scopeListQuery` narrows every list
call to the caller's tenant, and to the caller's own records when the caller is a student. Auditors
are read/export only, and sponsors can never read another sponsor organization's applicants.

## Operational impact

- **Authorization** is checked before each mutation; a denial returns a stable reason code that the UI maps to a message.
- **Retries** use bounded exponential backoff up to five minutes and stop after `MAX_WEBHOOK_ATTEMPTS`.
- **Replay protection** rejects any delivery whose timestamp is outside `WEBHOOK_TOLERANCE_MS` or whose delivery id was already processed.
- **Secret rotation** issues a new `secretRef` without downtime; both the previous and current secret are accepted during the rotation window.
- **Idempotency records** are retained for a bounded window (`IDEMPOTENCY_RETENTION_MS`) and pruned afterwards so the store does not grow without limit.
- **Breaking contract changes** block the compatibility gate until a version bump is recorded.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Retry returns a different outcome | Key not bound to the same actor/operation | Rebuild the key with `buildIdempotencyKey` |
| `PAYLOAD_MISMATCH` conflict | Same key reused with different body | Use a fresh nonce per user action |
| Webhook signature rejected | Stale timestamp or wrong secret | Check clock skew and the active `secretRef` |
| Duplicate delivery processed twice | Consumer ignored the delivery id | Deduplicate on the envelope `id` |
| Contract gate blocked | Response field removed | Bump the contract version and notify consumers |
| 403 with `CROSS_TENANT_DENIED` | Principal and resource belong to different tenants | Confirm the sponsor organization / platform scope |
| Student cannot see an application | `ownerId` does not match the caller | Students may only read their own records |
