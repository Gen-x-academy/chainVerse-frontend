# Scholarships UI: Atomic Application Submission

## Overview
Atomic application submission provides an accessible, robust frontend journey and typed API integration that evaluates eligibility, form completeness, supporting documents, versioned consents, round deadlines, and applicant uniqueness in **one unified submission transition**.

Key system invariants:
- **Atomicity**: Validation across all 6 pillars happens in a single transaction. Partial submissions or incomplete drafts are never locked into review.
- **Editable Draft Preservation**: If any validation check fails, the submission is halted, structured diagnostics are returned to the user, and the draft remains 100% editable in place without losing statement text, uploaded attachments, or form inputs.
- **Single Immutable Receipt**: Upon successful transition, exactly one digital submission receipt is issued, containing a cryptographic receipt hash, timestamp, and unique receipt identifier.
- **Idempotency & Replay Protection**: Each submission carries a client-generated nonce and idempotency key (`application.submit:{actorId}:{roundId}:{clientNonce}`). Retries of an existing submission replay the exact same receipt without duplicating the application record or creating multiple database rows.

## Ownership
- **Product Owner**: Student Access and Scholarship Review Committee
- **Engineering Owner**: Frontend Platform Engineering and Application Lifecycle Services
- **Security & Privacy Partner**: Information Security & Compliance Office

## Privacy
- **Data Minimization**: Personal statements, financial aid requests, and uploaded evidence are only transmitted when affirmative versioned consents are accepted.
- **Encrypted Document Sessions**: Supporting documents (transcripts, income evidence) use short-lived, encrypted, server-side-managed private upload sessions. Public URLs are never exposed.
- **Consent Audit Trail**: Affirmative agreements for terms, privacy notice, data sharing, and sponsor disclosures record timestamps and version identifiers for full GDPR/FERPA compliance.
- **Confidentiality During Verification**: In-flight validation checks run without persisting unverified sensitive financial data to long-term storage if validation fails.

## Migration
- **Backward Compatibility**: Existing simple application forms (`ScholarshipApplyForm`) continue functioning alongside the atomic flow.
- **Zero-Downtime Database Migration**:
  - Introduce `scholarship_submission_receipts` table with `receipt_id` (PRIMARY KEY), `application_id`, `round_id`, `student_id`, `receipt_hash`, `idempotency_key` (UNIQUE), and `summary` (JSONB).
  - Introduce `scholarship_idempotency_records` table with bounded TTL (24-hour expiration) for atomic deduplication.
- **Client Route Migration**:
  - Legacy `/scholarships/apply` gracefully transitions applicants to the atomic journey at `/scholarships/apply/atomic` with open round pre-selection.

## Operational impact
- **SLIs & Performance Targets**:
  - Atomic submission transition latency: `< 350ms` at p95.
  - Zero duplicate application records in round queues (0% duplicate submission rate).
  - Draft state recovery rate: 100% draft preservation on validation or transport failures.
- **Failure Modes & Resiliency**:
  - If a network error occurs during submission, the client preserves the draft and displays an accessible `role="alert"` with a retry trigger.
  - If a student hits "Submit" multiple times rapidly, client-side button disabling and the idempotency store guarantee that only one submission transaction is executed.
- **Monitoring & Alerting**:
  - Track `atomic_submission_validation_failures_total` partitioned by failure kind (`eligibility`, `form_completeness`, `documents`, `consent`, `deadline`, `uniqueness`).
  - Alert on sudden spikes in deadline check failures or document scan rejections.

## Troubleshooting
- **Submission Blocked with Incomplete Form**:
  - Ensure personal statement contains at least 80 characters.
  - Check that requested funding amount does not exceed the round's maximum award limit.
- **Missing Required Documents**:
  - Verify that an academic transcript is uploaded and that the automated security scan status is `clean`.
  - If applying on financial-aid grounds, attach valid income verification evidence.
- **Idempotency Conflict**:
  - Occurs if a client attempts to submit differing application payloads with an already consumed client nonce. Resetting the draft generates a fresh client nonce.
- **Deadline Passed**:
  - Check round `applicationDeadline`. Submissions attempted after the deadline timestamp are automatically rejected by both client and API validation middleware.
