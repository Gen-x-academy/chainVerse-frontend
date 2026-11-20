# CAPSTONE-102 — Resolve project disputes (frontend)

Covers team, review, IP and funding disputes. A claim records a reason code, opaque evidence references and response/appeal deadlines. Respondents answer before the deadline; an authorized reviewer records a reasoned outcome with a remedy code; parties may appeal within the appeal window; applying the remedy is idempotent and replays on retry. Invalid, stale, expired and cross-tenant transitions return stable `INTEGRITY_*` errors.

Endpoint: `GET/POST /integrity/disputes` via typed `integrityApi`, with `Idempotency-Key` and `If-Match` revision on every mutation. `publicDispute()` strips evidence references, and audit events include only allowlisted metadata — no private negotiation text, identity, research, safety or financial payloads.

`/integrity/disputes` exposes loading, empty, error, conflict and success states, labelled/keyboard-accessible controls, `aria-live` updates and a responsive timeline. Rollout is gated by integrity roles; rollback hides the route while server records remain. Analytics must only record lifecycle codes. CAPSTONE-102 backend and mobile work must enforce the same lifecycle, deadline and privacy invariants.
