# MENTOR-006: Versioned mentorship contracts

| Field | Value |
| --- | --- |
| Work item | MENTOR-006 |
| Issue | #1253 |
| Owner | Memplethee-lab |
| Depends on | MENTOR-001 (workflow vocabulary), MENTOR-004 (transition vocabulary) |

## Scope

Versioned command/query/event schemas for everything crossing the mentorship
boundary, so a wording or shape change can never silently reinterpret an
in-flight record.

## Envelope model

Every payload moves as `MentorshipContractEnvelope<TPayload>`:

| Field | Rule |
| --- | --- |
| `contract` | One of the registered contract names (`engagement.create`, `engagement.transition`, `payment.quote`) |
| `version` | A registered schema version; deprecated versions are rejected with a targeted message |
| `correlationId` | Required; retries and events are deduplicated on it |
| `issuedAt` | ISO 8601 instant |
| `payload` | Validated by the contract's registered validator |

Stable error codes on every violation: `UNKNOWN_CONTRACT`,
`UNSUPPORTED_CONTRACT_VERSION`, `MISSING_CORRELATION_ID`,
`SCHEMA_VALIDATION_FAILED`.

## Primitive schemas

- **Money.** Integer minor units with an explicit currency (`XLM` or `USDC`).
  Floats and negative amounts are always invalid; this keeps on-chain
  settlement free of rounding surprises.
- **Pagination.** `page` >= 1, `pageSize` between 1 and 100 (default 20).
  Requests outside the bounds are rejected client-side.
- **Windows.** ISO 8601 date-times; `endsAt` is optional but must be strictly
  after `startsAt`.
- **Evidence references.** Opaque id + URI, optional 64-hex-character SHA-256
  digest, optional ISO `capturedAt`.
- **Nullable versus omitted.** A field typed `T | null` means "known to be
  empty"; an optional field means "not sent". Nothing else is valid.

## Compatibility policy

`MENTORSHIP_CONTRACT_REGISTRY` lists, per contract: `latestVersion`,
`supportedVersions`, and `deprecatedVersions`. A version is dropped by first
marking it deprecated in a minor release, then removing it from
`supportedVersions`. `validateContractEnvelope` therefore rejects deprecated
versions with an actionable upgrade hint, and `findContractRegistration`
surfaces a human-readable `compatibility` note for the contracts page.

## Module and tests

`src/features/mentorship/contracts.ts`; tests in
`__tests__/contracts.test.ts` cover the primitives' bounds, envelope
validation, unknown contracts, missing correlation ids, deprecated and
unsupported versions, and payload validators per contract.

## Dependencies on other repositories

- **Contracts outreach:** the canonical schema versions are mirrored with the
  smart-contract repository; a contract change there is a republished version
  here, never a silent footnote.
- **Backend/API:** must accept the same envelopes on
  `/mentorship/engagements`, `/mentorship/engagements/:id/transitions`, and
  `/mentorship/payments/quotes`.
