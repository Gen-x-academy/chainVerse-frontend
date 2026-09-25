# Scholarships UI: Duplicate Application Prevention & Controlled Merges

## Overview
Duplicate application prevention provides configurable uniqueness enforcement, safe multi-session draft reconciliation, and a controlled administrative merge workflow for scholarship and bursary programs.

Key capabilities and acceptance criteria:
- **Configurable Uniqueness Policies**: Programs define uniqueness boundaries (`one_per_program_lifetime`, `one_per_round`, `allow_multi_with_cap`) to prevent applicants from submitting multiple active records.
- **Idempotent Replays**: Retrying an already submitted application returns the existing verified submission receipt without creating duplicate rows or re-triggering reviewer assignments.
- **Safe Draft Reconciliation**: When concurrent draft updates collide across browser tabs or mobile/desktop sessions, the draft reconciler safely merges edits (combining unique supporting documents and preserving detailed personal statements) with zero data loss.
- **Controlled Administrative Merges**: When duplicate submissions occur (such as cross-session accidents or multiple accounts for the same student), administrators can review the pair side-by-side, transfer verified supporting evidence, select surviving fields, transition the secondary record to `merged`, and generate an immutable audit record.

## Ownership
- **Product Owner**: Student Access & Admissions Review Committee
- **Engineering Owner**: Frontend Platform Engineering and Identity & Deduplication Services
- **Audit & Compliance Owner**: Operational Integrity & Legal Review

## Privacy
- **Identity Hash Matching**: Duplicate detection compares cryptographic hashes of verified identity markers (student ID, verified email, national registration token) rather than broad scans of unencrypted personal data.
- **Audit Trail Minimization**: Merge logs record administrator user IDs, timestamps, affected application IDs, and justified reasons without exposing sensitive student financial records.
- **Cross-Tenant Isolation**: Uniqueness rules and duplicate clusters are strictly isolated within each tenant and organization; sponsors cannot view applications across unrelated programs.

## Migration
- **Backward Compatibility**: Existing scholarship programs default to `one_per_program_lifetime` policy unless configured otherwise.
- **Database Schema Migration**:
  - Add `uniqueness_policy` (VARCHAR) and `max_applications_per_applicant` (INT) columns to `scholarship_programs`.
  - Add unique composite index on `(program_id, student_id)` where `status NOT IN ('merged', 'withdrawn')`.
  - Introduce `application_merge_audits` table storing primary and merged secondary application references.
- **Legacy Deduplication Script**:
  - Run background migration script to detect and cluster historical duplicates, flagging them for controlled administrator review in the merge console.

## Operational impact
- **SLIs & Performance Targets**:
  - Uniqueness evaluation latency: `< 30ms`.
  - Duplicate submission rate: 0.0% (strict idempotency and unique index protection).
  - Draft reconciliation data loss rate: 0.0%.
- **Locking & Concurrency Control**:
  - Distributed lock leases (30-second TTL) prevent race conditions when two rapid submissions from the same student arrive concurrently.
- **Failure Modes & Resiliency**:
  - If the cluster detection endpoint experiences downtime, client-side uniqueness rules enforce local idempotency checks to prevent new duplicates from being generated.

## Troubleshooting
- **Student Receives "Active Application Already on File" Notice**:
  - Verify if the applicant already submitted an application in the active round or program.
  - The warning component provides a direct link to view their previously generated submission receipt.
- **Draft Conflict Detected**:
  - The safe draft reconciliation dialog automatically opens, allowing the student to combine documents or pick the latest edits without losing work.
- **Unmerging an Erroneously Merged Application**:
  - Administrators can inspect the audit trail under `/scholarships/manage/duplicates` to view the original state and restore the secondary record if approved by the review committee.
