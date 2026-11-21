# CAPSTONE-099 — Report project integrity concerns (frontend)

The form accepts one of seven categories (authorship, fabrication, plagiarism, safety, funds, conduct, disclosure), a severity, opaque evidence references and a safe contact preference (`none`, platform email, platform phone). It deliberately has no free-text description field: narrative, identity and financial content must stay in the restricted backend.

Endpoint: `GET/POST /integrity/reports` via the typed `integrityApi`, with a stable `Idempotency-Key` and `If-Match` revision. Reviewer-only triage and reasoned resolution accept/decline/escalate and uphold/not-upheld/refer with a reason code; duplicate reports are replayed rather than created twice. Audit records carry only category, status and reason code.

`/integrity/reports` provides loading, empty, error, conflict, and success states, labelled/keyboard-accessible controls, `aria-live` announcements and responsive layout. Rollout is gated by integrity roles; rollback hides the route while server records remain. Analytics must exclude report content and contact preferences. CAPSTONE-099 backend and mobile work must enforce the same privacy and deduplication rules.
