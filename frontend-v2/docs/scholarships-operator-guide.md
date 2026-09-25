# Scholarships operator guide

## Overview
The scholarships feature spans eligibility rules, applicant consent, supporting documents, staging/testnet seed
runs, launch readiness, and a compatibility gate. This guide is for operators who run the scholarship service,
release it to production, and keep its API contract, schema, and on-chain ABI compatible with consumers.

## Ownership
- Product owner: Student Access team.
- Engineering owner: Frontend platform and policy services.
- Launch and rollback owner: Platform engineering, with Finance operations for fund handling.
- Privacy and Legal owns consent policy versions and sponsor disclosure.
- Data engineering owns migrations and rehearsal.

## Operational responsibilities
- Keep the release checklist signed off by each named owner before any go-live.
- Draft and verify a rollback plan that preserves active applications and funds.
- Schedule the post-launch review with named reviewers and measurable criteria before launch closes.
- Review the compatibility gate on every PR that touches artifacts.

## Privacy and identity
- Never use real applicant PII in demo or test data. Staging and testnet runs are synthetic-only.
- Consent records must be versioned and re-requested when policy changes.
- Sensitive evidence (income band, attestation, geography) is disclosed to sponsors only with permission.
- Audit uploads, scans, reviews, and consent changes per the privacy retention policy.

## Migration
- Move any demo mappings behind the typed API client when the policy service is available.
- Preserve existing application and fund records across migrations; rehearsals must roll back cleanly.
- Keep seed runs reproducible from their seed key and reversible from their rollback manifest.
- Promote new artifacts only after the compatibility baseline and approvals are updated.

## Operational impact
- Alerting monitors decision slope, payment failures, upload scan rejections, and consent re-requests.
- The compatibility gate blocks breaking API, event, database, or ABI changes until approval exists.
- Rollback disables feature flags, retains every active application, and holds or reverts in-flight funds.
- Supporting channels must be staffed during launch; runbook availability is a blocking criterion.

## Troubleshooting
- **Gate failing in CI** — compare the PR artifacts against the baseline; record a compatibility approval with
  the tracking issue before merging.
- **Seed run not reversible** — confirm the rollback manifest contains every created ID; revoke does one call
  and marks the run revoked.
- **Not ready despite passing checks** — confirm every blocking check has a named owner sign-off; a passed
  check without a sign-off keeps the gate blocked.