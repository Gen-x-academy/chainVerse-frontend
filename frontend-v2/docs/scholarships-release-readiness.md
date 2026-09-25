# Scholarships release readiness and rollback

## Overview
Launch gating for the scholarships feature is a checklist across security, privacy, accessibility, solvency,
support, monitoring, and data migration. Every blocking criterion must be signed off by its named owner before
the checklist can close, and a dated post-launch review with named reviewers is booked before go-live.

## Ownership
- Readiness and rollback: Platform engineering.
- Fund solvency and payouts: Finance operations.
- Privacy policy versions: Privacy and Legal.
- Support runbook: Student support.
- Data migration rehearsal: Data engineering.

## Checks and sign-off
Each check carries a measurable criterion, a named owner, and a severity. Blocking checks must pass; advisory
checks (such as the scheduled post-launch review) must be resolved before the review criterion passes. Sign-off
records the identity performing the sign-off and the timestamp.

## Rollback plan
A rollback plan records the feature flags to disable, every active application retained, and a fund action for
each fund. Rollback never deletes applications: active applications are always preserved. Funds are held while
a payout is in flight or reverted when already disbursed, with a guard that keeps reverted amounts in escrow
until the affected application is verified.

## Migration
- Rehearse data migration in staging and confirm the rollback preserves application and fund records.
- Keep artifacts (API contracts, events, database schema, Stellar ABI) under the compatibility gate.

## Operational impact
- Alerting covers uptime, p95 latency, decision slope, payment failures, and support escalations.
- The launch is blocked while any blocking check is open or a required owner sign-off is pending.
- Drafting a rollback plan is available to operators before launch so a reversal is never improvised.

## Troubleshooting
- **Check stays blocked after work is done** — confirm the named owner re-passes the check with their sign-off
  identity; a passed check without a sign-off keeps the gate blocked.
- **Review cannot be scheduled** — the review date must be in the future, at least one reviewer must be
  assigned, and at least one measurable criterion must be set.