# MENTOR-068: Session recording consent controls

This frontend slice adds participant-facing recording policy and consent controls at
`/mentorship/sessions/{sessionId}/recording`. It is a UI and typed API integration,
not a recording service. Recording authorization, consent persistence, state
transitions, enforcement, retention deletion, and provider access remain server-owned.

## Contract and dependencies

The API must provide:

- `GET /mentorship/sessions/{sessionId}/recording` returning the session policy,
  each participant's consent state, role-scoped permissions, recording state,
  retention/access policy, and an optional opaque provider reference.
- `POST /mentorship/sessions/{sessionId}/recording/consents` with a `grant`,
  `decline`, or `revoke` decision, a `participant` or `guardian` scope, and
  idempotency key.
- `POST /mentorship/sessions/{sessionId}/recording/start` and `/stop`, each with
  an idempotency key. The API must recheck permissions, policy, all participant
  approvals, guardian approval where applicable, current session state, and the
  configured revocation behavior atomically.

The corresponding shared MENTOR-068 work is required in the **ChainVerse backend**
(authorization, consent ledger, idempotent transitions, audit trail, provider
integration and retention enforcement), **contracts** (only if recording consent
or a provider reference is represented on-chain; raw media and consent evidence
must never be placed on-chain), and **mobile** (the same policy vocabulary,
participant and guardian flow, and stop behavior). API error codes and policy enums
must remain aligned across repositories.

## Privacy and minors

- Client payloads contain decisions and opaque idempotency keys only. The client
  never uploads, downloads, plays, or publishes media.
- Provider references are validated as opaque identifiers and never rendered or
  sent to analytics. The API must not return signed media URLs to this frontend.
- Analytics records only the session's opaque identifier, a derived actor key,
  stage, timestamp, and dedupe key. It excludes consent text, names, media, and
  provider references.
- Recording is unavailable for a prohibited policy. Starting requires explicit
  `granted` consent from every participant; a minor additionally requires an
  affirmative guardian-consent state. Missing, ambiguous, or failed authorization
  is denied by default.
- The policy response must disclose retention duration, who may access recordings,
  and whether revocation stops immediately or at session end. The backend must
  execute this policy and enforce deletion; displaying it is not enforcement.

## Rollout

Ship with the backend endpoints and provider controls disabled until all clients
support policy negotiation and the API can prove consent-before-start, replay-safe
commands, auditability, revocation, private storage, retention deletion, and minor
safeguards. Validate staging flows for prohibited, optional, and required modes;
guardian consent; participant decline/revocation; role denial; duplicate retries;
and expired sessions. Roll back by disabling recording server-side; never rely on
the frontend alone to stop or prevent capture.

## Verification

Vitest covers consent gating, guardian safeguards, role permission flags,
accessible status/error/empty states, keyboard interaction, and provider-reference
privacy. Browser-level responsive and assistive-technology checks should be run
against the integrated API before rollout.
