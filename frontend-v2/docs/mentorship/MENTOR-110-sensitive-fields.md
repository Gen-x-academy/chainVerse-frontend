# MENTOR-110 — Protect mentorship secrets and sensitive fields

Closes #1357. Shared work item: **MENTOR-110** (Privacy track).

## Scope

Classify and protect provider tokens, identity references, private notes, precise
locations, evidence keys, and payout details with controlled key rotation.

## Behaviour

- **Classification** — `SENSITIVE_FIELD_CLASSIFICATIONS` maps each field to
  `secret`, `pii`, `confidential`, or `financial`.
- **Redaction** — `redactRecord` deep-redacts sensitive keys; `redactError`
  strips secret-like tokens from messages and stacks so failures cannot leak
  plaintext. `containsSensitiveData` detects leakage before logging.
- **Least privilege & audit** — `FIELD_ACCESS` is an explicit allow-list; absent
  roles and unlisted actions are denied. `auditAccess` records every attempt with
  the redacted value.
- **Key rotation** — `rotateKey` advances the active version while retaining
  prior versions; `canDecrypt` confirms historical data stays readable.

## APIs

`redactRecord`, `redactValue`, `redactError`, `containsSensitiveData`,
`authorizeFieldAccess`, `auditAccess`, `rotateKey`, `canDecrypt`.

## Dependencies & privacy

- Backend owns the KMS/keyset; this module only models policy and redaction.
- Plaintext must be absent from logs, analytics events, and error reporting.
- Backups inherit the same encryption and access controls.

## Rollout

Introduce redaction at log/event boundaries first, then enforce field-level
access. Rotate keys on a schedule and on suspected compromise; never delete old
versions before re-encryption completes.

## Tests

`npx vitest run src/features/mentorship/__tests__/sensitive-fields.test.ts`
covers classification coverage, nested redaction, error redaction, deny-by-default
access, auditing, and rotation.

## Related MENTOR-110 work

Backend, KMS, and observability must adopt the same classifications and rotation.
