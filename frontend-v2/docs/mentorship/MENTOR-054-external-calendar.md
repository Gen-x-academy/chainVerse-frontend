# MENTOR-054: Connect external calendar availability

## Scope

`src/features/mentorship/availability/external-calendar.ts` models revocable
external calendar connections and imports only free/busy windows. It never
retains event titles, descriptions, locations, attendees, or other event
content.

`external-calendar.service.ts` is the typed API client.
`components/ExternalCalendarPanel.tsx` is the responsive connection manager
with empty, loading, success and error states, labelled native controls and
`aria-live` feedback.

## Privacy boundary

- The browser never receives or persists a raw provider token. A connection
  stores only an opaque `vault:` handle plus a key version supplied by the
  server-side token vault.
- Only the `calendar.freebusy` scope is accepted. Requests for event content
  scopes are rejected with `INVALID_SCOPE`.
- Provider events are reduced to `{ startsAt, endsAt }`. Cancelled events are
  ignored; confirmed and tentative events are treated as busy.
- The state contains only busy intervals and connection metadata. Event
  content is discarded before it reaches the state.
- Disconnecting clears the token handle and sync cursor and removes future busy
  windows from that connection. Past busy windows may remain for historical
  accuracy.

## Authorization and revocation

Authorization is deny-by-default. A connection can be managed only by its
mentor or an administrator in the same tenant. Other mentors and other tenants
are denied with `NOT_AUTHORIZED`.

Disconnect is idempotent: revoking an already-revoked connection returns the
same state without adding another audit entry.

## Sync safety

- Every sync carries an `idempotencyKey`. A replay returns the original state
  without adding windows, moving the cursor, or writing another audit entry.
- A successful sync replaces that connection's busy-window snapshot instead of
  appending duplicates.
- Busy windows are sorted and merged deterministically, so overlapping intervals
  always produce the same result.
- Provider failures degrade gracefully: the previous busy windows and
  `lastSyncedAt` stay in place, the attempt is audited as `degraded`, and the
  caller receives a retryable `PROVIDER_UNAVAILABLE` error.
- Revoked connections cannot sync; the UI keeps the last successful data
  visible while blocking further access.

`subtractBusyWindows` applies imported busy intervals to bookable availability
slots, so external commitments can be removed before showing open times.

## Dependencies

- **Backend/API** must implement:
  - `GET /mentorship/availability/calendar/connections?mentorId={mentorId}`
  - `POST /mentorship/availability/calendar/connections`
  - `POST /mentorship/availability/calendar/connections/{connectionId}/sync`
  - `DELETE /mentorship/availability/calendar/connections/{connectionId}`
- The backend owns the OAuth exchange, provider refresh tokens, encryption at
  rest, token-vault key rotation, scope enforcement, provider rate limits and
  the sync worker.
- **Contracts** own the connection, busy-window and error shapes mirrored here.
- **Booking service** must consume the same free/busy boundary and must never
  receive event content.
- **Mobile** must use the same free/busy-only import and revoke semantics.

## Rollout

1. Deploy the token vault, OAuth callback and sync worker first.
2. Enable connections for a staging cohort with a short sync interval and verify
   reconnect, revoke and provider-failure behaviour.
3. Shadow-run busy-window subtraction against staging availability before
   enabling external calendars in production.
4. Roll out to mentors, then administrators. Monitor `PROVIDER_UNAVAILABLE`,
   `NOT_AUTHORIZED`, replay counts and degraded sync audits.
5. Revocation must take effect immediately; retention of historical busy windows
   follows the platform data-retention policy.

## Tests

`external-calendar.test.ts` covers token-handle validation, scope enforcement,
tenant and owner authorization, content stripping, deterministic busy-window
normalization, sync snapshots, idempotent replays, degraded provider failures,
revoked-connection denial, disconnect cleanup and busy-window subtraction. The
component tests cover empty/loading/error/success states, provider selection,
connect/sync/disconnect flows, revoked connections, denied permissions, action
failures and keyboard operation.
