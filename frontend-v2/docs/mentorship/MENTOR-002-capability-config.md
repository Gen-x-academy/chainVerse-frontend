# MENTOR-002 — Mentorship capability configuration

Closes #1249. Source: `src/features/mentorship/config/`.
Shared work item: **MENTOR-002** (Foundation track). Route: `/mentorship/config`.

## What this is

A single validated document controls every mentorship capability per
environment: feature flags, limits, supported currencies, session durations,
cancellation windows, and evidence rules. Configuration is data, not a build
flag — a rollout is a document change, not a redeploy.

## Resolution order

`resolveMentorshipConfig(overrides, environment)`:

1. Start from `SAFE_DEFAULT_MENTORSHIP_CONFIG` — **every flag off**,
   conservative limits, USD only, 30/60-minute sessions.
2. Deep-merge the remote overrides onto the defaults, section by section, so a
   partial document cannot erase an unrelated field.
3. Validate. If anything fails, the **safe defaults win** and the errors are
   returned; the merged document is discarded wholesale.

The resolver is a pure function of its inputs — no implicit `process.env` read —
so the same code runs in tests, the browser, and the startup check.

## Validation

| Code | Meaning |
| --- | --- |
| `UNKNOWN_ENVIRONMENT` | environment is not development/staging/production |
| `EMPTY_CURRENCIES` / `UNSUPPORTED_CURRENCY` | currency list empty or off-list |
| `DEFAULT_CURRENCY_NOT_SUPPORTED` | default not in the supported set |
| `EMPTY_SESSION_DURATIONS` / `UNSUPPORTED_SESSION_DURATION` | bad duration set |
| `DURATION_EXCEEDS_MAX` | max duration not one of the configured durations |
| `NON_POSITIVE_LIMIT` | a limit is zero, negative, or non-finite |
| `NEGATIVE_WINDOW` / `NOTICE_EXCEEDS_WINDOW` | cancellation window vs. notice |
| `INVALID_EVIDENCE_SIZE` | max evidence size is not a positive number |

Each error carries a stable `code` and the `path` that failed, so a form maps
errors to fields without parsing English.

## Safe defaults

| Field | Default | Rationale |
| --- | --- | --- |
| feature flags | all `false` | an unreachable/invalid config never enables a capability |
| `maxActiveEngagementsPerMentor` | 5 | caps blast radius before policy is set |
| `maxSessionsPerEngagement` | 12 | bounds a default engagement |
| `maxSessionDurationMinutes` | 60 | matches the 30/60-minute duration set |
| `minCancellationNoticeHours` | 24 | protects mentors from late cancels |
| `cancellationWindowHours` | 48 | notice must fit inside the window |
| currencies | `USD` | single-currency until finance opts in |
| evidence | summary + accepted deliverable required | settlement is evidence-gated |

## Startup validation

`assertMentorshipConfigAtStartup(overrides, environment)` resolves the document
and logs a structured error when it is rejected, so a bad deploy is visible at
boot rather than at first use. It never throws: availability beats strictness on
the read path.

## Observability without secrets

The panel and the resolver render only flags, limits, currency codes, and rule
booleans. The document contains **no applicant data and no secrets** — no API
keys, no payout credentials. Logging emits the validation codes only.

## Privacy boundaries

A configuration holds no personal data. It may be cached and read by any
authenticated operator; only `organization-staff` and `administrator` may edit
it (see [MENTOR-003](./MENTOR-003-role-permission-matrix.md)).

## Rollout

- Additive: no existing module is replaced; the route is new.
- Flags start off, so shipping this changes no behaviour until an owner writes a
  document.
- The client degrades to safe defaults against a backend that has not shipped
  `/mentorship/config` — the correct pre-migration posture.

## Dependencies on other repositories

- **Backend** exposes `GET`/`PUT /mentorship/config?environment=…`.
- **Contracts** (MENTOR-002) own the field names and allowed values.
- **Mobile** consumes the same document; validation codes are shared vocabulary.

## Verify

- `npx vitest run src/features/mentorship/__tests__/config.test.ts` — merge,
  validation, safe-default fallback, and "never enable on invalid".
- `npx vitest run src/features/mentorship/config` — the panel's loading,
  permission, and save states.
- `npx tsc --noEmit`.
- Route smoke: open `/mentorship/config` as `organization-staff` (writes
  enabled) and as `student` (consistent access-denied state).
