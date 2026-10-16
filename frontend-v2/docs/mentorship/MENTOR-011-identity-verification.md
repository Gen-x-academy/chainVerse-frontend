# MENTOR-011 — Mentor identity verification

Closes #1258. Source: `src/features/mentorship/identity/verification/`.
Shared work item: **MENTOR-011** (Identity track).

## What this is

The identity-verification workflow for mentors. A mentor submits consent and an
**opaque evidence reference** to an approved provider; an authorized reviewer
approves or rejects it. The state machine is
`unverified -> pending -> verified | rejected`, and an approved verification
becomes `expired` once its time-to-live elapses.

## Never store the document

- `looksLikeRawDocument(value)` detects a data URI or a hosted `.pdf`/image file.
- `prohibitedDocumentKeys(payload)` lists payload keys (`document`, `file`,
  `idImage`, `passportScan`, `attachment`, `rawDoc`) that must never be sent.
- `validateVerificationSubmission(verification)` rejects an unknown provider
  (`UNKNOWN_PROVIDER`), missing consent (`CONSENT_REQUIRED`), a raw document
  (`RAW_DOCUMENT_PROHIBITED`), and a missing reference (`MISSING_EVIDENCE_REF`).

Only an opaque `evidenceRef` is ever persisted.

## Expiry removes eligibility

- `isVerificationExpired(verification, now)` compares `expiresAt` to the clock.
- `evaluateVerification(verification, now)` derives the effective status: a
  `verified` record past its expiry is `expired`.
- `isMentorEligible(verification, now)` is `true` only for a current `verified`
  status.
- `VERIFICATION_TTL_MS` is the default approval lifetime (365 days) applied when
  a provider does not set an expiry.

## Authorized review only

`canReviewVerification(reviewer, verification)` allows a `moderator` or
`administrator` and always refuses self-review (`SELF_REVIEW_PROHIBITED`);
another role is denied with `NOT_AUTHORIZED_REVIEWER`.

## Replay-safe callbacks

`applyVerificationCallback(verification, callback)` applies a provider callback
once. It records `callback.callbackId` in `processedCallbackIds`, so a retried
webhook returns the record unchanged and never produces a second effect.

## Re-verification and disclosure

- `startReverification(verification)` resets the attempt to `pending`, clears the
  review detail, and increments `attempts`.
- `discloseVerification(verification, now)` returns the public view: a boolean
  `eligible`, the status, an optional expiry, and `reverificationRequired`. It
  never exposes the provider, evidence, or rejection detail.

## API

`mentorshipVerificationService` maps to `/mentorship/verifications`: `get`,
`submit`, and `review`.

## Verify

```sh
npx vitest run src/features/mentorship/identity/__tests__/verification.test.ts
npx tsc --noEmit
```
