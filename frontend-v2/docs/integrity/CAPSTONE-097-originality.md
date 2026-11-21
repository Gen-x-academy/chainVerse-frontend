# CAPSTONE-097 — Originality and citation checks (frontend)

## Dependencies and boundaries

- API: `GET/POST /integrity/checks`; typed through `integrity/shared.ts` (`integrityApi`).
- Every mutation sends the same `Idempotency-Key` on retry and `If-Match` with the expected revision.
- Consent is explicit, scoped and attributed to the submitter; without it no check is queued.
- Provider-specific statuses are normalized once into `pending | processing | ready | error` and then into a provider-independent check lifecycle.
- Scores and excerpt references are restricted: `publicCheck()` strips them, and `auditEvent()` only serializes allowlisted metadata. No manuscript text, identity, financial or research payload is logged or placed in a URL.

## Lifecycle

`draft → queued → running → report_ready → human_review | completed`; `failed → queued` is a retry. Reviewers release only reports below the configured thresholds; a threshold breach must be escalated. Invalid, stale or cross-tenant transitions return stable error codes (`INTEGRITY_STALE_VERSION`, `INTEGRITY_INVALID_TRANSITION`, `INTEGRITY_TENANT_MISMATCH`).

## UI and accessibility

`/integrity/originality` renders explicit loading, empty, error, conflict, and success states with `aria-live`/`role=alert`, labelled inputs, keyboard-operable controls, a mobile disclosure nav and responsive layouts. Navigation is derived from server-granted roles with deny-by-default capability checks.

## Rollout and rollback

Roll out behind the integrity workspace role mapping; the read-only view can ship first. Rollback hides the nav entry and route while leaving server-side data untouched. Analytics must record only lifecycle event names/codes, never scores or excerpts. CAPSTONE-097 backend/API and mobile work must enforce the same consent, threshold and privacy invariants.
