# CAPSTONE-098 — Research ethics screening (frontend)

Screening must precede project activation and any material change. The UI collects only boolean risk indicators and derives an approval pathway (`exempt`, `expedited`, `full_board`, `blocked`); it never collects research payloads, identity or financial details. Approval is decided by an approver-only capability, and a material change requires a newer project version, superseding the old decision.

Endpoint: `GET/POST /integrity/screenings` via the typed `integrityApi`. Each mutation uses a stable `Idempotency-Key` and `If-Match` revision, with stable errors for forbidden, stale, conflicting and invalid transitions. Audit events use allowlisted metadata only.

`/integrity/screening` shows loading, empty, error, conflict, and success states with accessible labels, `aria-live`, keyboard-operable controls and responsive layout. Rollout is gated by the integrity role mapping; rollback hides navigation/route while server records remain. Analytics may record only pathway/status codes. CAPSTONE-098 backend and mobile implementations must enforce the same version and privacy boundaries.
