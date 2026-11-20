# CAPSTONE-087 — Manage expense reimbursement claims (frontend-v2)

Issue: #1513. Shared work item CAPSTONE-087, Funding track.

## Scope

Submit categorized expenses with constrained evidence, validate against
policy, separate submitter from reviewer, approve or reject with a reason, and
link exactly one payout per approved claim.

## Implementation

`src/features/capstone/expense-reimbursement.ts` provides pure functions for
submission, decision and payout linkage. It enforces the claim policy
(amount, category, evidence count, media type and size), tenant boundaries,
stable revisions, reviewer separation, a required rejection reason, and
idempotency by request id, claim fingerprint and payout reference. The claim
and UI view states are explicit: loading, empty, error, conflict and success.

Stable error codes: `FORBIDDEN`, `TENANT_MISMATCH`, `STALE_REVISION`,
`INVALID_STATE`, `POLICY_INVALID`, `REVIEWER_SEPARATION`, `REASON_REQUIRED`,
`PAYOUT_CONFLICT`.

## Privacy and audit boundary

Private notes, rejection reasons, evidence identifiers and payout references
stay on the claim record. Audit events carry only event type, claim id, request
id, status or code, and no private payloads. Analytics record stable codes only.

## Dependencies and cross-repo work

Requires the backend CAPSTONE-087 claim, review and payout-link endpoints with
tenant-scoped policy configuration and server-side uniqueness constraints.
Companion work lives in the shared CAPSTONE-087 backend and payments
repositories; this frontend assumes their typed contract.

## Rollout and rollback

Enable behind the capstone funding flag for one tenant, verify reviewer
separation and duplicate-payout handling, then expand. Rollback disables the
flag and hides the new claim workflow; the client owns no persisted state, so
no data migration is needed.
