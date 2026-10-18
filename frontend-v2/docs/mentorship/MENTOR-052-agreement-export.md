# MENTOR-052: Export participant agreement records

## Scope

`src/features/mentorship/agreements/agreement-export.ts` provides a
privacy-safe export of a mentorship agreement for a participant. The bundle
contains:

- the accepted, versioned terms;
- the amendment history and the participants who accepted each amendment;
- approval and acceptance decisions;
- a session summary (counts, completed minutes, first/last session, and a
  sanitized session list);
- the financial summary (agreed, paid, refunded and outstanding amounts).

`agreement-export.service.ts` is the typed API client for requesting, polling
and downloading an export. `components/AgreementExportPanel.tsx` is the
responsive entry point: it renders an explicit empty, loading, error and
success state, uses a labelled format selector and native buttons for keyboard
access, and announces progress through a polite live region. Analytics are
emitted through the existing `mentorship/analytics` envelope with the
`agreement_export` stage.

## Authorization and privacy

Authorization is deny-by-default. The actor must appear in
`AgreementExportSource.participants`; no role, staff member, or guardian is
implicitly authorized. A denied request is audited with a stable reason.

The export is built from an explicit allow-list rather than by spreading source
records. The following fields are never serialized:

- `terms.internalNotes`
- `approvals[].internalNote`
- `amendments[].internalNote`
- `sessions[].privateNote`

`AgreementExportBundle.privacy` records that private notes were excluded and
lists the excluded field paths. Only the participant who requested the link may
use it.

## Abuse controls

- Each actor may generate three exports per rolling hour. Further requests
  return `RATE_LIMITED` with a `retryAfterMs` hint.
- A request carrying an `idempotencyKey` returns the original job on retry. It
  does not create another job, consume another rate-limit slot, or write a
  second audit entry.
- Download links expire after 15 minutes. An expired link returns `LINK_EXPIRED`
  and the job is marked `expired`; the bundle is never returned.
- Successful and denied requests and downloads are appended to the audit trail.

Error codes (`NOT_A_PARTICIPANT`, `INVALID_AGREEMENT`, `INVALID_FORMAT`,
`RATE_LIMITED`, `LINK_NOT_FOUND`, `LINK_EXPIRED`, `LINK_NOT_OWNED`) are stable
and carry an HTTP status suitable for the API adapter.

## Dependencies

- **Backend/API** must implement:
  - `POST /mentorship/agreements/{agreementId}/exports`
  - `GET /mentorship/agreements/exports/{jobId}`
  - `GET /mentorship/agreement-exports/{token}`
- The API repeats every authorization, rate-limit, idempotency and expiry check.
  The client guard is a UX boundary only.
- The API owns the audit record, link signing and retention window. The client
  calls the same contract and must not persist the downloaded bundle.
- **Contracts** own the agreement version, amendment and approval shapes
  mirrored in this module. A contract change that renames or removes a field is
  a breaking change to the export schema.
- **Mobile** should expose the same participant-only export and the same
  redaction boundary. The schema version `1` in the bundle is the compatibility
  marker across clients.

## Rollout

1. Deploy the API endpoints and audit/link-expiry enforcement first.
2. Enable the export entry point for mentors and mentees in a staging
   environment, then verify rate limiting and expiry with a short TTL.
3. Roll out to production participants. Staff and guardian access is not part of
   this work item and remains denied.
4. Monitor `RATE_LIMITED`, `LINK_EXPIRED` and denied-audit counts. Retention of
   generated exports follows the platform data-retention policy; links are not
   reusable after expiry.

## Tests

`agreement-export.test.ts` covers participant-only authorization, record
contents, private-note exclusion, rate limiting, idempotent retries, link
ownership, link expiry and audit behaviour using deterministic fixtures.
