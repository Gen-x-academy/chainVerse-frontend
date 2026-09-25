# Scholarships operations, migration and administration

## Overview

This surface covers four operational capabilities for the scholarships domain:

- **Domain events outbox** — program, application, decision, award, milestone, and payment facts are written to an outbox in the same transaction as the state change they describe. Every envelope carries a schema version, a correlation id, and a stable dedupe key (`issue #1162`).
- **On-chain settlement reconciliation** — backend award and payment intents are matched against authoritative Stellar/Soroban transactions. A payment is only shown as confirmed when the transaction is final and every field agrees (`issue #1164`).
- **Legacy financial-aid migration** — existing financial-aid applications are mapped into the scholarship domain with dry runs, batch resumption, and full reporting of unmapped data (`issue #1165`).
- **Administration configuration** — limits, deadlines, providers, assets, templates, and risk thresholds are managed as one validated, versioned, previewable document (`issue #1167`).

The operator surface lives at `/scholarships/operations`.

## Ownership

Platform engineering owns the event outbox, settlement reconciliation, and administration
configuration. Student Access and policy services own the legacy financial-aid data being migrated
and sign off on the mapping before any live run.

## Privacy

Events, reconciliation reports, and migration reports never carry applicant PII beyond opaque
identifiers. Legacy reviewer notes are reported as unmapped fields rather than copied into the
scholarship domain. Administration configuration only ever returns secret *references*
(`ref:...`); raw signing secrets and payment-provider keys are never serialized to the client.

## Migration

Legacy records are mapped with `mapLegacyAidRecord`, then processed by `runLegacyMigration`, which
is **dry-runnable**, **resumable in batches** via `resumeFromLegacyId`, and **idempotent** —
re-running from a checkpoint never duplicates an already-migrated record. Legacy identifiers and
original `submittedAt`/`decidedAt` timestamps are preserved verbatim, and rejected legacy
applications are reported as skipped rather than silently dropped.

## Operational impact

- **Settlement mismatches** (`AMOUNT_MISMATCH`, `ASSET_MISMATCH`, `DESTINATION_MISMATCH`,
  `TRANSACTION_FAILED`, `MISSING_TRANSACTION`, `NOT_FINAL`) must be acknowledged by an operator
  using `scholarshipSettlementService.acknowledgeMismatches` before a payout is retried.
- **Event replays** are safe: consumers deduplicate on `dedupeKey`, so a retried publish produces a
  single downstream effect.
- **Configuration changes** are versioned and audited upstream; `preview` must be reviewed before
  `save`, and a validation error blocks the change.
- **Migration** should always be executed as a dry run first, and the unmapped-field report
  reviewed, before a live run.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Payout stuck as `submitted` | Transaction not yet final (`NOT_FINAL`) | Wait for finality depth (`FINALITY_LEDGER_DEPTH`) |
| Payout `failed` | `TRANSACTION_FAILED` mismatch | Reconcile, then re-issue the intent |
| Missing payout | `MISSING_TRANSACTION` | Verify the `txHash` / memo mapping |
| Migration stops early | `complete: false` with `resumableFrom` | Resume with `resumeFromLegacyId` |
| Config save blocked | Validation errors returned | Fix the reported field and preview again |
