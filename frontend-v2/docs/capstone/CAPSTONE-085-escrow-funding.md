# CAPSTONE-085 — Confirm project escrow funding (frontend-v2)

Issue: #1511. Shared work item CAPSTONE-085, Funding track.

## Scope

The confirmation surface reconciles provider/ledger finality, underpayment,
overpayment, asset, destination and the signed agreement before funds may be
marked available. A transfer is never confirmed while it is pending or failed,
when the agreement is superseded or for a non-fundable project state, or when
amounts, asset or destination disagree.

## Implementation

- `src/features/capstone/escrow-confirmation.ts` — pure, deterministic
  reconciliation and transition rules. Deny-by-default authorization, tenant
  checks, revision checks, request-id idempotency and provider-reference
  ownership prevent duplicate confirmations and cross-tenant or cross-project
  replay.
- `src/features/capstone/escrow-funding-api.ts` — typed API DTO. Amounts cross
  the boundary as decimal strings of minor units and are converted to `bigint`.
- `src/features/capstone/components/EscrowFundingPanel.tsx` — responsive,
  keyboard-operable panel with explicit loading, empty, error, conflict and
  success states, `aria-live` status and `role="alert"` for errors.

Stable error codes: `FORBIDDEN`, `TENANT_MISMATCH`, `STALE_REVISION`,
`INVALID_STATE`, `AGREEMENT_MISSING`, `AGREEMENT_INVALID`,
`OBSERVATION_MISSING`, `PROVIDER_NOT_FINAL`, `PROVIDER_FAILED`,
`ASSET_MISMATCH`, `DESTINATION_MISMATCH`, `UNDERPAYMENT`, `OVERPAYMENT`,
`REFERENCE_CONFLICT`.

## Privacy and audit boundary

Audit events contain only event type, request id, project id, timestamp and a
stable code. They never contain private notes, memos, evidence, destination
addresses or amounts. Private financial content stays off public ledgers and
logs; analytics use stable codes only.

## Dependencies and cross-repo work

Requires the backend CAPSTONE-085 endpoint to expose agreement, provider
observation and revision, with server-side idempotency and reference locks.
Companion work lives in the shared CAPSTONE-085 backend and smart-contract/ledger
repositories; this frontend assumes their typed contract.

## Rollout and rollback

Ship behind the existing capstone feature flag for a single tenant first, then
enable for all tenants once finality and under/overpayment paths are verified.
Rollback disables the flag and restores the previous read-only funding view; no
schema migration is required on the client, and the feature writes no ledger
state directly.
