# Scholarships UI: Application Opening and Deadline Windows

## Overview
Application opening and deadline windows define deterministic boundary instants, explicit timezones, network grace periods, and late-submission policies for scholarship and sponsorship programs.

Key capabilities and invariants:
- **Deterministic Boundary Instants**: Local opening and closing dates/times are paired with an explicit IANA timezone and mapped deterministically to exact UTC ISO-8601 instants (`computeUtcInstant`).
- **Range Invariants**: Invalid ranges (e.g. `open >= close`, negative grace periods, or late cutoffs occurring before closing deadlines) fail validation immediately.
- **Grace Periods**: Configurable network grace periods (e.g. 15, 30, 60 minutes) absorb latency for in-flight submissions and network packet delays immediately following the nominal deadline.
- **Late-Submission Rules**: Explicit policies (`strict_reject`, `allow_with_penalty`, `requires_waiver`, `discretionary_review`) govern whether applications received past the grace period can be accepted.
- **Historical Invariance / Grandfathering Rule**: **Deadline changes do not silently invalidate submitted applications**. If an administrator adjusts a deadline earlier or cancels a round extension, applications that were already submitted within the valid window when active remain permanently valid.

## Ownership
- **Product Owner**: Scholarship Operations & Student Access Product Committee
- **Engineering Owner**: Frontend Platform Engineering and Institutional Integration Services
- **Audit & Compliance Owner**: Legal & Academic Registry Services

## Privacy
- **Timezone Minimization**: Selected timezones are associated with the program round itself, never exposing the applicant's private geolocation or IP address.
- **Audit Log Retention**: Administrative adjustments to deadlines record who made the change, the UTC timestamp, previous vs proposed deadlines, and the justified reason without exposing student PII.
- **Waiver Token Encryption**: Administrative waiver tokens for late submissions are cryptographically hashed and verified without leaking student identity details to unauthorized viewers.

## Migration
- **Backward Compatibility**: Existing scholarship rounds without an explicit `ApplicationWindow` object inherit fallback defaults (opening at `round.opensAt` and closing at `round.applicationDeadline` in UTC with a standard 15-minute grace period).
- **Database Schema Migration**:
  - Introduce `program_deadline_windows` table with `id` (PRIMARY KEY), `program_id`, `round_id`, `open_instant_utc` (TIMESTAMPTZ), `close_instant_utc` (TIMESTAMPTZ), `time_zone` (VARCHAR), `grace_period_minutes` (INT), `late_submission_policy` (VARCHAR), `version` (INT), and `created_at` (TIMESTAMPTZ).
  - Introduce `deadline_change_audit_records` table tracking previous/new deadline instants and grandfathered application counts.
- **Zero-Downtime Rollout**:
  - Read path checks `program_deadline_windows` and falls back to `scholarship_rounds.application_deadline`.
  - Background migration backfills active rounds into dedicated window records.

## Operational impact
- **SLIs & Availability**:
  - Deterministic boundary calculation latency: `< 5ms`.
  - Submission timing classification latency: `< 15ms`.
  - Non-invalidation compliance rate: 100% (zero submitted applications invalidated by schedule changes).
- **Clock Drift & NTP Synchronization**:
  - Server endpoints evaluate timestamps against synchronized NTP sources. Client-side clocks are checked against server headers on initialization to detect and warn on local clock skew ($> 60$ seconds).
- **Grace Period Traffic Handling**:
  - During the final 30 minutes of a deadline, client-side auto-retry and in-flight request queues prevent premature timeout cancellations.
- **Failure Modes & Resilience**:
  - If timezone resolution fails, the engine falls back safely to UTC representation with an explicit operator warning.

## Troubleshooting
- **Submission Blocked as Past Deadline**:
  - Verify the student's submission timestamp against `closeInstantUtc` and `gracePeriodEndUtc`.
  - Check whether the program's timezone matches the expected regional time (e.g. UTC+3 for `Africa/Nairobi`).
- **Shortened Deadline Impact**:
  - In the manager dashboard, inspect the grandfathering assessment modal to view any applications submitted prior to the change. All such applications remain valid and will not be canceled.
- **Late Submission Requiring Waiver**:
  - When `lateSubmissionPolicy` is set to `requires_waiver`, an applicant must provide a valid administrative waiver token issued by the scholarship sponsor.
