# MENTOR-120 — Rollout and migration plan

Closes #1367. Shared work item: **MENTOR-120** (Operations track). Version: `1.0.0`.

## What this is

The frontend rollout strategy for the mentorship capability, covering feature
flags, pilot tenants, data migrations, compatibility gates, monitoring,
support readiness, rollback triggers, and phased general availability. All
changes are restartable and backward-compatible; rollback avoids orphaning
funds or agreements.

## Dependencies

- **Backend (mentorship API)** — stable v1 endpoints for operations dashboard,
  discovery, applications, matches, agreements, funding, sessions, milestones,
  reviews, credentials, and disputes.
- **Identity/platform auth** — session cookies and role/tenant claims that map
  to `MentorshipRole`. Role mapping: `admin` → `administrator`.
- **Finance/contracts** — funding/settlement observability (escrow references,
  payment status) with explicit read-only views for finance role.
- **Trust & Safety** — dispute workflow hooks and moderation audit events.
- **Monitoring/observability** — analytics events (see [frontend-v2/docs/analytics.md](../../docs/analytics.md))
  and Sentry coverage for the new mentorship pages/components.

## Feature flags

| Flag | Default | Scope | Rationale |
| --- | --- | --- | --- |
| `mentorship.enabled` | `false` | Tenant/rollout group | Gate all `/mentorship` routes and API calls. |
| `mentorship.operations.dashboard` | `false` | Coordinator cohort | Ship dashboard (MENTOR-116) to pilot coordinators only. |
| `mentorship.e2e` | `false` | CI only | Permit synthetic journeys in non-prod environments. |

Flags are read from capability config (MENTOR-002) and evaluated client-side for
UX gates; server-side enforcement is required and separate.

## Pilot

- **Pilot tenants**: `tenant-pilot-a`, `tenant-pilot-b` (explicit allowlist).
- **Pilot cohort**: organization-staff, moderators, finance, administrators.
- **Success measures**: dashboard load < 200ms p95 (cold), time-to-first-action
  < 3s, zero duplicate-effect incidents in 24h, recovery success rate ≥ 99% for
  retried submissions, and no unauthorized access events.
- **Kill switch**: disable `mentorship.operations.dashboard` and
  `mentorship.enabled` per tenant within 5 minutes.

## Migrations (frontend)

- **Restartable and idempotent**: no destructive client-side schema writes;
  localStorage keys (`mentorship.operations.filters`) are backward-compatible
  (parsing falls back to defaults). Filter serialization (`serializeFilters`)
  appends `programId` safely; parsing tolerates unknown values.
- **Compatibility gate**: features consume the public barrel
  `@/src/features/mentorship` (MENTOR-003 boundary). No imports from internal
  submodules across feature boundaries.
- **Data shape**: all API responses normalized (`normalizeDashboardSnapshot`)
  with explicit `INVALID_PAYLOAD`/tenant checks. Stale data is labeled in UI
  (`STALE_AFTER_MS = 300000`).

## Rollout phases

| Phase | Trigger | Action | Verification |
| --- | --- | --- | --- |
| 0. Dark launch | Flags off, behind auth | Deploy code to main; no traffic. | Lint/typecheck, unit tests, e2e mocked. |
| 1. Canary (internal) | `mentorship.enabled=true` for admin cohort | Enable hub and operations for pilot admins. | Smoke `/mentorship`, dashboard loads, no console errors. |
| 2. Pilot | Add coordinator cohort + pilot tenants | Enable operations dashboard flag. | Pilot success measures met; access denied for non-pilot roles. |
| 3. Beta | All allowlisted orgs | Broad rollout to staff roles. | Zero P0 regressions; monitoring alerts quiet. |
| 4. GA | All tenants (feature complete) | Remove pilot allowlists; keep kill switches. | Post-mortem criteria satisfied. |

Each gate requires owner approval before advancing.

## Monitoring and support

- **Analytics**: dashboard load/error/refresh, filter changes, intervention
  actions (with idempotency key, not PII). Aggregates only, no document
  content.
- **Privacy boundaries**: `looksLikeRawDocument` guard exists in identity flows;
  never log raw documents or PII. Tenant-scoped storage only.
- **Support readiness**: runbook for kill switches, idempotency key handling,
  stale snapshot triage, and cross-tenant denial messages
  (`describeMentorshipDenial`). SLOs documented.
- **Rollback triggers**: cross-tenant leakage, duplicate effects despite
  idempotency, orphaned funds/agreement state, >10% error rate on operations
  load over 10 min, or auth bypass. Rollback: disable flags, revert traffic,
  preserve audit logs (append-only). No data deletion.

## Rollback safety

- Idempotent interventions: `runIntervention` caches succeeded keys and returns
  `applied=false` on retry, preventing duplicate effects.
- Tenant-first enforcement: `normalizeDashboardSnapshot` rejects mismatched
  `tenantId`; RBAC checks `principal.tenantId !== resource.tenantId` → `CROSS_TENANT_DENIED`.
- Self-approval denied for sensitive actions; deny-by-default everywhere.
- No orphaned funds: operations are read-heavy (dashboard) and intervention
  writes are idempotent with audit (references tracked). Agreement/funding
  states transition via explicit lifecycle tables (MENTOR-001); no in-place
  destructive updates in frontend.

## Corresponding work

- MENTOR-116 (Frontend): Coordinator operations dashboard — [#1363](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1363)
- MENTOR-118 (Frontend): Load and concurrency tests — [#1365](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1365)
- MENTOR-119 (Frontend): E2E mentorship journey — [#1366](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1366)
- MENTOR-120 (Frontend): Rollout and migration plan — [#1367](https://github.com/Gen-x-academy/chainVerse-frontend/issues/1367)

This plan identifies dependencies, privacy boundaries, rollout considerations,
and gates without prescribing implementation details that may change post-audit.
