# Scholarships load testing (deadline burst)

## Overview

The synthetic deadline-burst generator used to ship inside the application. It
lived at `src/features/scholarships/load-testing.ts` and was rendered by
`ScholarshipLoadTestPanel`, a client component that
`ScholarshipOperationsPanel` mounted on the production route
`/scholarships/operations`. That put the burst coordinator, its target profile,
and a trigger button in the browser bundle of a route any signed-in user could
load, and it let a user fire synthetic application traffic at the scholarship API
straight from the product UI.

It is now operator tooling:

| Concern          | Before                                                        | After                                                     |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Location         | `src/features/scholarships/load-testing.ts`                    | `scripts/load-tests/scholarship-deadline-burst.ts`          |
| UI trigger       | `ScholarshipLoadTestPanel`, rendered on `/scholarships/operations` | none — CLI only                                        |
| Entry point      | a button in the operator surface                                | `npm run loadtest:deadline`                                |
| Production guard | none                                                            | `assertNonProductionTarget` + explicit API token           |
| Enforced by      | nothing                                                         | `npm run lint` + `npm run check:production-imports`         |

`scripts/` is outside the App Router route graph, so nothing in it is bundled or
reachable from a page.

## Running the tool

```bash
# Node 22.6+ is required for `node --experimental-strip-types`; `npx tsx` works too.
export SCHOLARSHIP_LOAD_TEST_TOKEN="…"      # a scoped, short-lived operator token
npm run loadtest:deadline -- \
  --base-url https://staging.chainverse.example/api \
  --tenant load-test-tenant-a \
  --requests 200 \
  --concurrency 10
```

Flags and their environment fallbacks:

| Flag           | Environment variable                   | Default             |
| -------------- | -------------------------------------- | ------------------- |
| `--base-url`   | `SCHOLARSHIP_LOAD_TEST_BASE_URL`       | required            |
| `--token`      | `SCHOLARSHIP_LOAD_TEST_TOKEN`          | required            |
| `--tenant`     | —                                      | `load-test-tenant-a` |
| `--requests`   | —                                      | `50`                |
| `--concurrency`| —                                      | `5`                 |

The tool prints `accepted=… duplicates=… rejected=…` and exits non-zero on
failure. It never prints the token.

## Authorization and safety rails

`assertNonProductionTarget(baseUrl)` runs before any request is issued — both
inside `runDeadlineBurst` and up front in `parseLoadTestArgs`, so a mis-typed
`--base-url` fails immediately instead of on the first fetch. It rejects any
host that is not local, staging, preprod, sandbox, test, or testnet, using the
same `isNonProductionHostname` predicate the browser gate uses, so the CLI and
the UI cannot disagree about what counts as production.

Additional rules:

- A bearer token is required. An environment that has load testing disabled
  simply rejects the calls, and the tool turns `401`/`403` into a
  `ScholarshipLoadTestAuthorizationError`.
- `429` is surfaced as `ScholarshipBackpressureError` with the server's
  `Retry-After`, not retried silently.
- `ScholarshipBurstCoordinator` throws `ScholarshipTenantBoundaryError` if a run
  is asked to cross tenants, and bounds concurrency so the generator cannot
  exceed the configured in-flight budget.

## Staging tooling gate in the UI

`/scholarships/staging` still offers the deterministic synthetic seed flow, but it
is now doubly gated by
`src/features/scholarships/utils/stagingEnvironment.ts`:

1. The build must opt in with `NEXT_PUBLIC_SCHOLARSHIPS_STAGING=1`. Without it the
   page renders a not-available notice instead of the controls.
2. When `NEXT_PUBLIC_API_BASE_URL` is set, its hostname must look non-production.
   A staging build pointed at the production API disables the tooling anyway.

The gate is a UX boundary only — the API must refuse its seed endpoints on its
own. See ADR-001: Privacy boundaries.

## Test profile

The synthetic profile is tenant-scoped to `load-test-tenant-a` and contains
10,000 applicants, 12,000 applications, 24,000 private documents, 250 reviewers,
and 1,500 awards, with a target burst of 500 requests/second around
`2026-10-01T23:59:59Z`. These records are synthetic and must never be replaced
with a production export.

Run full profiles in an isolated environment with API, queue, object storage,
notification, and ledger test doubles. Capture p50/p95/p99 latency, accepted
throughput, `429` rate, duplicate rate, and resource saturation per journey
(search, submit, upload, review, notify, decision, payout). Stop a run when error
budgets or queue/storage thresholds are exceeded.

## Ownership

Platform engineering owns the generator, the non-production predicate, and the
API's load-test authorization. API/finance owns enforcement, queues, award
decisions, and payout settlement. Applicant essays and document contents are
excluded from fixtures and telemetry; uploads use private encrypted sessions with
access logs.

## Privacy

The generator carries no real applicant data. Its token is a short-lived,
tenant-scoped credential; treat it as a secret, pass it through the environment
rather than shell history, and rotate it after each run.

## Migration

No data migration is required. Existing runs of the old in-browser panel stop
working by design: the panel is deleted, so use the CLI. If a deployment needs the
staging seed page, set `NEXT_PUBLIC_SCHOLARSHIPS_STAGING=1` in that environment
only.

## Troubleshooting

| Symptom                                        | Likely cause                                | Action                                                        |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `Refusing to generate load against "…"`         | `--base-url` points at production          | Point it at staging/testnet, or use a local stack              |
| `--base-url … is required`                      | no flag and no `SCHOLARSHIP_LOAD_TEST_BASE_URL` | Set one                                                    |
| `The scholarship API rejected the load-test token` | token missing, expired, or not enabled | Re-issue a scoped operator token; the API must also opt in     |
| `TypeError` on `--experimental-strip-types`     | Node older than 22.6                        | Upgrade Node, or run `npx tsx scripts/load-tests/scholarship-deadline-burst.ts` |
| `rejected=` climbing with `429`                 | target is saturating                        | Back off; this is the backpressure signal you wanted to see    |
| `npm run check:production-imports` fails        | app code imports the tool or the fixtures   | Move the import into a test, or delete it                       |
