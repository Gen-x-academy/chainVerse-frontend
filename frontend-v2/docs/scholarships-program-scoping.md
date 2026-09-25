# Scholarships Program Scoping: Cohort and Academic-Term Scoping

## Overview
Program scoping enables sponsors and administrators to associate scholarship programs, bursaries, and sponsorships with specific cohorts, academic terms, courses, institutions, and geographic regions. Scopes are validated and queryable, overlap behavior is explicit, and inactive scopes cannot receive new applications.

Key capabilities:
- **Multi-dimensional Scoping**: Target combinations of Academic Cohorts (e.g. `SCE-26A`), Academic Terms (e.g. `FA26`, `SP27`), Courses (e.g. `BC-101`), Institutions (e.g. `CV-ACAD`), and Regions (e.g. `africa`, `asia`, `europe`).
- **Gating Invariant**: Inactive and archived scopes strictly reject new student applications (`canScopeAcceptApplications` returns `canAccept: false` with typed codes such as `SCOPE_INACTIVE`).
- **Explicit Overlap Behavior**: Configurable policies (`allow_concurrent`, `disallow_overlap`, `strict_exclusive`) govern whether students can hold or apply to concurrent programs across overlapping cohorts and terms.
- **Accessible User Journeys**: Complete operator management interface (`ProgramScopeManager`) and student discovery interface (`ProgramScopeExplorer`) with comprehensive state handling.

## Ownership
- **Product Owner**: Student Access & Scholarships Product Committee
- **Engineering Owner**: Frontend Platform Engineering and Institutional Integration Services
- **Institutional Owner**: Partner University & Academy Coordinators
- **Security & Privacy Partner**: Data Protection & Privacy Governance Office

## Privacy
- **Student Data Minimization**: Scope definitions store references to cohort, term, course, institution, and region identifiers rather than raw student identifying records.
- **Cohort De-identification**: Public and student-facing queries only surface active aggregate enrollment counts without exposing participant rosters or personally identifiable information (PII).
- **Tenant & Sponsor Isolation**: Scopes are partitioned by tenant; sponsors cannot view or modify scopes belonging to other organizations unless explicitly federated.
- **FERPA & GDPR Compliance**: Student eligibility evaluations run in memory or within authenticated zero-knowledge boundary services where academic standing, course registrations, and financial aid history are evaluated without persisting unneeded tracking logs.

## Migration
- **Backward Compatibility**: Existing programs without explicit scope associations default to global/open scope with backward-compatible fallback rules.
- **Database Schema Migration**:
  - Introduce `program_scopes` table referencing `program_id`, `cohort_ids` (UUID[]), `term_ids` (VARCHAR[]), `course_ids` (UUID[]), `institution_ids` (UUID[]), `regions` (VARCHAR[]), `status` (VARCHAR), and `overlap_policy` (VARCHAR).
  - Add partial indexes on `status = 'active'` and GIN indexes on array dimensions for fast multi-attribute filtering.
- **Zero-Downtime Rollout**:
  - Phase 1: Deploy new typed client contracts and UI modules (`src/features/scholarships/scoping/`).
  - Phase 2: Run dry-run migration script to backfill existing active programs into baseline scoped targets.
  - Phase 3: Enforce strict application gating rejecting inactive scope submissions.

## Operational impact
- **SLIs & Availability**:
  - Scope query latency target: `< 150ms` at 95th percentile using client-side React Query caching and HTTP `stale-while-revalidate`.
  - Application intake gating evaluation: `< 25ms` deterministic in-memory validation.
- **Application Inactive Scope Gating**:
  - Inactive scopes immediately reject all new submission requests. API middleware verifies scope active status before creating new application records in `scholarships_applications`.
- **Overlap Conflict Detection**:
  - Evaluated on scope creation, update, and application submission.
  - Blocking policies (`disallow_overlap`, `strict_exclusive`) reject incompatible concurrent submissions with structured error payloads.
- **Failure Modes & Resilience**:
  - If network or API transport fails, the frontend falls back gracefully to cached state and displays accessible error alerts with manual retry triggers without crashing the application shell.

## Troubleshooting
- **Student Unable to Submit Application**:
  - Verify scope status is `active`. If status is `inactive` or `archived`, applications are closed by design.
  - Verify application date window: check if `applicationStartDate` is in the future or `applicationEndDate` has elapsed.
  - Check applicant context matches: verify student's registered cohort, term, institution, and region correspond to the scope's targeted dimensions.
- **Overlap Conflict on Program Activation**:
  - Inspect `selectedScopeForOverlap` diagnostics in the manager UI to view conflicting cohort and term intersections.
  - Adjust the `overlapPolicy` to `allow_concurrent` if mutual participation is approved by the sponsor, or reschedule the cohort dates.
