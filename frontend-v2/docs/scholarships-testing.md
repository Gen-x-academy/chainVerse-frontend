# Scholarships domain unit tests and integration tests

## Overview

The scholarship feature ships two complementary test suites:

- **Domain unit tests** (`test/scholarships/domain.test.ts`) cover program, application, award, milestone, and payment rules at their boundaries. Every documented state transition is exercised, illegal transitions return a typed `ILLEGAL_TRANSITION` error, re-entering a state is a no-op, and amount/ordering boundaries are table-driven (`issue #1168`).
- **Integration tests** (`test/scholarships/integration.test.ts`) verify persistence, queues, rollback, authorization, and the service adapters together through one mocked transport. Fixtures are built per test and the in-memory store is disposable, so no test depends on shared mutable external state (`issue #1169`).
- **Fraud signal tests** (`test/scholarships/fraud.test.ts`) cover the pure detectors behind payout anomaly detection and duplicate identity/document abuse, asserting that every signal is explainable, protected, and routed to human review (`issues #1146 and #1147`).

Run them with `npm test --workspace frontend-v2` (or `npx vitest run test/scholarships`).

## Ownership

Platform engineering owns the domain state machines and the transport used by the integration suite.
Feature owners must add a case to the transition tables and a test whenever a new state or boundary is
introduced.

## Privacy

Fixtures use synthetic identifiers only (`fixture-student-1`, `seed-*`). Tests must never read or
write real applicant data, and integration tests must not point at a live API — the transport is
mocked so no personal data leaves the test process.

## Migration

When the domain adds a state, update the relevant `*_TRANSITIONS` table in `domain.ts` **and** add the
new case to `domain.test.ts`; the "accepts every transition listed in the tables" test fails if a
table entry and its test drift apart. Legacy fixtures are replaced by `createFixtureSet` calls rather
than edited in place.

## Fraud signals

The fraud detectors are pure functions so they can be tested at their boundaries: `detectPayoutAnomalies`
checks unusual destinations, rapid wallet changes, repeated failures, duplicate ledger references, and
suspicious splits, while `detectIdentityAbuse` checks duplicate applicants, reused documents, manipulated
evidence, and coordinated submissions. Tests assert the concrete signal codes produced, and that every
signal carries `requiresHumanReview: true` — the detectors pause high-risk payouts (`shouldPausePayout`)
but never auto-reject. `redactFraudEvidence` and `assertNoSensitiveEvidence` guard biometric and
sensitive evidence from leaking into logs, screenshots, or test snapshots.

## Operational impact

- **Deterministic**: seed runs and fixtures are reproducible, so failures are not flaky.
- **Isolated**: `createInMemoryStore` is disposable and `transport.reset()` runs before and after each integration test.
- **Typed errors**: assertions check specific error codes (`ILLEGAL_TRANSITION`, `AMOUNT_BELOW_MINIMUM`, `AMOUNT_ABOVE_MAXIMUM`, `MILESTONE_ORDER_VIOLATION`) instead of free-text messages.
- **CI**: the suites run as part of `npm test` in the frontend CI workflow.

## Deadline burst targets and dataset

The synthetic deadline profile is tenant-scoped to `load-test-tenant-a`. It contains
10,000 applicants, 12,000 applications, 24,000 private documents, 250 reviewers, and
1,500 awards. The target burst is 500 requests/second around `2026-10-01T23:59:59Z`.
These records are synthetic and must never be replaced with production exports.

| Journey         | Signals                                 | Saturation expectation                  |
| --------------- | --------------------------------------- | --------------------------------------- |
| Search          | latency, errors, queue age              | bounded backpressure; no tenant leakage |
| Submit          | accepted, duplicate, deadline rejection | one result per idempotency key          |
| Upload          | upload latency, scan queue age          | private expiry; no duplicate document   |
| Review/decision | assignment latency, decision errors     | explicit permission denial              |
| Notification    | delivery lag, retries                   | deduplicated retries                    |
| Award/payout    | batch latency, settlement mismatch      | no duplicate payment intent             |

The browser probe only exercises synthetic coordinator backpressure. Full runs belong in
an isolated environment with API, queue, object storage, notification, and ledger test
doubles. Capture p50/p95/p99 latency, accepted throughput, `429` rate, duplicate rate,
and resource saturation for every journey.

## Ownership, privacy, migration, and operations

Platform/frontend owns the coordinator, typed client contracts, and accessibility states;
API/finance owns enforcement, queues, award decisions, and payout settlement. Tenant ids
are validated before work starts. Applicant essays and document contents are excluded from
fixtures and telemetry; uploads use private encrypted sessions with access logs. This is
additive and requires no data migration. The operational change is an administrator-only
readiness probe and its metrics; stop a run when error budgets or queue/storage thresholds
are exceeded.

## Troubleshooting

| Symptom                                | Likely cause                            | Action                                               |
| -------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| New transition not accepted            | Table entry not added                   | Update `*_TRANSITIONS` in `domain.ts`                |
| Integration test hits the network      | `@/src/lib/api-client` not mocked       | Confirm the `vi.mock` factory is present             |
| Test bleeds into another               | Fixture shared across tests             | Build fixtures per test with `createFixtureSet`      |
| Authorization test passes unexpectedly | `transport.setFailure(null)` not reset  | Rely on `beforeEach`/`afterEach` `transport.reset()` |
| Fraud test sees unexpected signals     | Fixtures share identity/document hashes | Build a dedicated `ApplicantRecord[]` per test       |
