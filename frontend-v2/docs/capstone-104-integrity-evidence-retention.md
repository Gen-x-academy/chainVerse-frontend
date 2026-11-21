# CAPSTONE-104: Integrity evidence retention (frontend)

This document covers the frontend-v2 slice of shared work item **CAPSTONE-104**
(“Define integrity evidence retention”) in the Integrity track. It applies
category-specific retention, deletion, legal holds, access logging and secure
disposal to reports, evidence, reviews and provider results.

The implementation is the pure domain module
`src/features/capstone/integrity-evidence-retention.ts` with its vitest suite
`integrity-evidence-retention.test.ts`. It follows the existing capstone
pattern: deterministic functions shared by routes, services and tests.

## Categories and default schedule

| Category | Default window | Basis | Disposal |
| :--- | :--- | :--- | :--- |
| `report` | 2555 days (7 years) | legal | `secure_delete` |
| `evidence` | 2555 days (7 years) | legal | `secure_delete` |
| `review` | 1095 days (3 years) | operational | `redact` |
| `provider_result` | 365 days (1 year) | contractual | `crypto_erase` |

A policy must define exactly one rule per category. A deletable rule must name a
recognised disposal method; a non-deletable rule must not. `validateRetentionPolicy`
reports every problem with a stable code.

## Policy precedence

`assessRetention` checks rules in this order:

1. **Active legal hold** — blocks disposal for the held subject/record and
   categories, even when the window has expired or the record is immutable.
2. **Immutable record** — records linked to a safety or financial obligation are
   never disposed.
3. **Indefinite or unreadable window** — retained.
4. **Inside the window** — retained with days remaining.
5. **Window closes today** — `review` before the next sweep.
6. **Window expired** — `delete` only when the rule is deletable and names a
   disposal method; otherwise retained.

`planDisposal` never deletes anything. It produces separate `deletable`,
`retained`, `blockedByHolds` and `immutable` lists for an operator or service to
act on. Records with no matching rule are retained and treated as immutable.

## Legal holds

`placeLegalHold` creates an active hold with a unique id, subject, categories and
private reason. Retries and duplicate active holds return the existing record.
`releaseLegalHold` requires `expectedRevision`, rejects stale revisions and
already-released holds, and records who released the hold and when.

## Secure disposal

`disposeEvidence` requires a current `delete` assessment for the same record.
It checks authorization, `expectedRevision`, record status and assessment
identity before marking the record `disposed` with the assessment’s disposal
method, timestamp and actor. Held, immutable, reviewed, mismatched, stale or
already-disposed records are rejected with stable codes.

## Access logging

`logEvidenceAccess` appends an immutable event for `view`, `export`, `download` or
`disclose`. Read access requires reviewer assignment; export-family actions
require export permission. Events carry the actor, action, record and an optional
private purpose for the security record, are idempotent on `requestId`, and are
rejected for disposed records or unknown actions.

## Authorization and tenancy

Authorization is deny-by-default (`authorizeEvidence` with
`evidenceActionsFor`).

| Role | View | Export | Place hold | Release hold | Dispose | Manage retention | Access log |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Reviewer | Assigned | — | — | — | — | — | — |
| Safety officer | Organization | Organization | Organization | — | — | — | Organization |
| Auditor | Organization | — | — | — | — | — | Organization |
| Organization admin | Organization | Organization | Organization | Organization | Organization | Organization | Organization |

Every action is checked against the organization boundary, and reviewer access
is limited to assigned records.

## Privacy boundaries

- `evidenceAuditEntry` keeps only the event type, record id, organization,
  category, status, revision, optional retention action and time. It omits
  subjects, hold reasons, access purposes, actor ids, free text and content.
- `summarizeRetention` and `summarizeAccessEvents` return aggregate counts only
  and suppress groups smaller than `ANALYTICS_MIN_GROUP` (default 3).
- Hold reasons and access purposes are private payloads and must not be sent to
  public ledgers, logs or analytics.
- No proposal, research, identity, safety or financial content is part of the
  audit/analytics output.

## Concurrency and retries

Place-hold, release-hold, dispose and access-log operations accept a
client-generated `requestId`; release and disposal also require an
`expectedRevision`. Retried request ids return the original result with
`replayed: true`, active duplicate holds are suppressed, and stale revisions
return `STALE_REVISION`.

Stable error codes include `NOT_AUTHORIZED`, `INVALID_HOLD`,
`DUPLICATE_HOLD_ID`, `STALE_REVISION`, `INVALID_STATE`, `NOT_DISPOSABLE`,
`RECORD_MISMATCH`, `INVALID_ACCESS` and `PURPOSE_TOO_LONG`.

## Dependencies

- `src/features/capstone/contracts-v1.ts` defines the shared stable error and
  envelope shapes.
- `src/features/capstone/participant-blocking.ts` and
  `src/features/capstone/output-provenance.ts` establish the request-id,
  revision-guard, preserved-record and privacy-safe audit conventions reused
  here.
- The scholarship retention module is a domain-specific implementation; this
  capstone module is the integrity-evidence counterpart and does not modify it.
- Corresponding **CAPSTONE-104** work in the other repositories owns durable
  storage, scheduled sweeps, legal-hold intake, secure disposal execution,
  access-log storage and the audit sink. The backend must enforce the same
  precedence, tenant and idempotency rules rather than trusting the client.

## Rollout and rollback

- Roll out behind the existing capstone feature flag. Start with read-only
  `planDisposal` previews and access logging, then enable holds and disposal per
  organization.
- The module is pure and has no persistence or schema migrations, so rollback is
  removing the feature-flag exposure and the module import. Existing records,
  holds, access logs and audit entries remain readable.
- If a policy changes, version it (`version`, `updatedAt`, `approvedBy`) so a
  disposal plan can be reproduced against the exact rule set that produced it.

## Verification

```bash
npm run test --workspace frontend-v2 -- src/features/capstone/integrity-evidence-retention.test.ts
npm run typecheck
npm run lint
```

The suite covers policy validation, category windows, hold precedence,
immutability, review/delete boundaries, disposal planning, the authorization
matrix, tenant boundaries, hold placement/release, secure disposal, access
logging, stale/retry suppression, audit redaction and small-group analytics
suppression.
