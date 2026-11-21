# CAPSTONE-103: Bidirectional participant blocking (frontend)

This document covers the frontend-v2 slice of shared work item **CAPSTONE-103**
(“Add bidirectional participant blocking”) in the Integrity track. A block
removes future discovery, invitations, matching, messaging and collaboration
between two participants, while required safety, financial and audit records
remain available.

The implementation is the pure domain module
`src/features/capstone/participant-blocking.ts` with its vitest suite
`participant-blocking.test.ts`. It follows the existing capstone pattern:
deterministic functions shared by routes, services and tests.

## Bidirectional effects

A block is stored in one direction (`blockerId` → `blockedId`) but applies in
both directions for effects:

- `isBlocked` and `activeBlockBetween` treat either direction as blocked.
- `blockedParticipantIds` returns everyone blocked with a participant in either
  direction.
- `filterDiscoverable` removes blocked participants from discovery candidates.
- `interactionAllowed` denies future `discovery`, `invitation`, `matching`,
  `messaging` and `collaboration` interactions in either direction.
- An unknown interaction kind is denied with `UNKNOWN_INTERACTION`.

Blocks are scoped to one organization; the same ids in another organization are
not affected.

## Preserved records

The preserved record classes are `safety`, `financial` and `audit`. A blocked
interaction decision returns these classes so callers can keep the required
history readable and immutable. Blocking never deletes or hides those records.

## Lifecycle and versioning

1. `validateBlockInput` checks ids, organization, participants, reason category,
   note length, timestamp and self-block prevention.
2. `createBlock` creates an active block at revision 1. A retry with the same
   request id, or a retry creating the same active direction with a new request
   id, returns the existing block with `replayed: true` instead of duplicating
   it. The opposite direction may still create its own block.
3. `liftBlock` lifts an active block with an `expectedRevision`; a retry with
   the same request id is replayed, and a stale or already-lifted block is
   rejected.
4. A new block can be created after a previous one is lifted.

## Authorization and tenancy

Authorization is deny-by-default (`authorizeBlock` with `blockActionsFor`).

| Role | Create | Lift | View | Audit view |
| :--- | :--- | :--- | :--- | :--- |
| Participant | Own pair | Own pair (blocker) | Own pair | — |
| Safety officer | Organization | — | Organization | Organization |
| Organization admin | — | Organization | Organization | Organization |
| Auditor | — | — | Organization | Organization |

Every role is checked against the organization boundary. Participants can view
a pair when they are either the blocker or the blocked participant, but only the
blocker can lift it. Self-blocks are rejected.

## Privacy boundaries

- `blockAuditEntry` records only the event type, block id, organization, status,
  revision and time. It omits both participant ids, the reason category and any
  free-text note.
- `summarizeBlocks` returns aggregate status and reason counts and suppresses
  reason groups smaller than `ANALYTICS_MIN_GROUP` (default 3). It never includes
  participant ids or notes.
- Notes are private payloads and must not be sent to public ledgers, logs or
  analytics.
- No financial amounts, proposal content or identity documents are part of this
  capability.

## Concurrency and retries

Every create and lift takes a client-generated `requestId`; lift also takes an
`expectedRevision`. Retried request ids return the original result with
`replayed: true`, active duplicate directions are suppressed, and stale lifts
return `STALE_REVISION`. This prevents duplicate blocks and repeated lift side
effects under concurrent requests.

Errors use stable codes: `NOT_AUTHORIZED`, `INVALID_BLOCK`, `DUPLICATE_BLOCK_ID`,
`STALE_REVISION` and `INVALID_STATE`.

## Dependencies

- `src/features/capstone/contributor-attribution.ts` and
  `src/features/capstone/output-provenance.ts` establish the request-id,
  revision-guard and privacy-safe audit conventions reused here.
- `src/features/capstone/contracts-v1.ts` defines the shared stable error and
  envelope shapes.
- Discovery, invitation, matching, messaging and collaboration surfaces should
  call `interactionAllowed` / `filterDiscoverable` before revealing or acting on
  another participant.
- Corresponding **CAPSTONE-103** work in the other repositories owns the
  persistence, API endpoints, notification suppression, safety-review workflow
  and audit sink. The backend must enforce the same bidirectional, tenant and
  idempotency rules rather than trusting the client.

## Rollout and rollback

- Roll out behind the existing capstone feature flag. Start by filtering
  discovery results in shadow mode, then enable create/lift per organization.
- The module is pure and has no persistence or schema migrations, so rollback is
  removing the feature-flag exposure and the module import. Existing blocks and
  preserved safety/financial/audit records remain readable.
- If an upstream contract changes, bump the shared contract version; the
  frontend reports unsupported versions instead of silently parsing them.

## Verification

```bash
npm run test --workspace frontend-v2 -- src/features/capstone/participant-blocking.test.ts
npm run typecheck
npm run lint
```

The suite covers validation, the authorization matrix, tenant boundaries,
bidirectional effects, discovery filtering, interaction denial, preserved
records, duplicate/retry suppression, stale and repeated lifts, audit redaction
and small-group analytics suppression.
