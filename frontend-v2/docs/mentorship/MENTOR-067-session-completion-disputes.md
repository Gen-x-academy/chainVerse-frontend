# MENTOR-067 session completion disputes (frontend)

The session dispute workspace lets a session participant challenge attendance,
completion, duration, or outcome before settlement. Both participants receive a
server-defined response window. An open dispute must pause the affected
settlement; moderator resolution records a decision, rationale, and immutable
audit event reference.

## API dependencies

The backend/API must implement and authorize these tenant-scoped operations:

- `GET /mentorship/disputes` returns only the viewer's eligible sessions and
  dispute records, with `tenantId`, response deadlines, server-computed action
  permissions, a viewer-relative `isOpenedByCurrentUser` flag (never an
  internal user id), paused settlement state for every open dispute, and
  auditable resolution data.
- `POST /mentorship/disputes` opens a dispute with a session public ID, issue,
  summary, and evidence references.
- `POST /mentorship/disputes/{publicId}/responses` records the other
  participant's response and optional evidence references before the deadline.
- `POST /mentorship/disputes/{publicId}/resolution` records a moderator's
  decision and rationale only after a response arrives or the response window
  expires.
- Mutations honor `Idempotency-Key`; return stable `401`, `403`, `409`, and
  `410` outcomes; enforce participant/moderator grants, deadlines, tenant scope,
  settlement holds, and append-only audit events on the server.

The UI deadline checks and RBAC are usability controls, not security controls.
They cannot pause funds, determine participant identity, or authorize a
resolution. Those effects belong to the backend and smart-contract settlement
integration. API responses for open disputes that do not report
`settlementStatus: "paused"` are rejected as invalid.

## Privacy and analytics

The frontend submits short text summaries and references only. It does not
upload, fetch, preview, or store evidence contents. Accept only HTTPS links or
opaque `evidence:` references; the evidence service must enforce access,
retention, malware scanning, and redaction. Avoid sensitive personal data,
especially for minors. Analytics events include an opaque dispute reference and
retry-safe dedupe key only, never summaries, evidence references, user ids,
names, or resolution rationale.

## Rollout

The route resolves the existing `disputes` feature flag before loading records;
the shared safe default is disabled. Set `NEXT_PUBLIC_MENTORSHIP_ENVIRONMENT` to
`development`, `staging`, or `production` when `NODE_ENV` does not identify the
deployment environment. A missing or invalid API config leaves the feature
disabled. Keep dispute creation disabled at the API until the backend, contract
settlement hold, and audit event dependencies are deployed and verified
together. Verify late responses, repeated requests, cross-tenant access, open
dispute settlement blocking, moderator separation, and resolution reconciliation
in staging before enabling production traffic. Roll back by disabling the route
and creation capability; do not clear dispute or audit records.

## Other ChainVerse repositories

This is the frontend delivery of shared work item **MENTOR-067**. The Backend/API
repository must deliver the scoped endpoints, authoritative deadlines,
idempotency, notifications, and audit records. The Contracts repository must
pause the affected settlement and apply only the audited resolution outcome.
The Mobile repository must mirror the issue categories, response windows,
participant permissions, evidence-reference boundary, and accessible states.
All repositories must agree on the response-window and resolution contract
before production rollout.
