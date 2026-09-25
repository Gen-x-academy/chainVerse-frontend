# Scholarships compatibility gate

## Overview
The compatibility gate protects consumers of the scholarships feature from breaking API contract, emitted
event, database schema, and on-chain Stellar ABI changes. Generated artifacts are compared against an approved
baseline; differences are classified as compatible, additive, or breaking. Breaking changes are blocked until an
explicit compatibility approval (tracking issue or version) is recorded.

## Ownership
- Gate logic and artifact generation: Platform engineering.
- Baseline maintenance: Platform engineering, with API ownership review churn on each approval.
- Tracking issue registration: The reviewer who plans the breaking migration.

## Artifacts and baselines
- API contracts live under `scripts/scholarships/artifacts/api-contracts.json`.
- Emitted events live under `scripts/scholarships/artifacts/events.json`.
- Database schema lives under `scripts/scholarships/artifacts/db-schema.json`.
- Stellar ABI lives under `scripts/scholarships/artifacts/stellar-abi.json`.
- Approved snapshots of each live in `scripts/scholarships/artifacts/baseline/`.
- Approvals are recorded in `scripts/scholarships/artifacts/compatibility-approvals.json`.

## Classification rules
| Change | Class |
| --- | --- |
| New endpoint, event, table, column, or ABI entry | Additive |
| Compatible relaxation (field made optional/nullable) | Compatible |
| Removed endpoint/table/column/event | Breaking |
| Request/response field removed | Breaking |
| Required field added or field type changed | Breaking |
| Column made NOT NULL or ABI signature changed | Breaking |

## Migration
- Additive changes merge without approval; baseline updates are cosmetic only.
- Breaking changes require a matching approval before the workflow can pass.
- Approvals must reference the tracking issue and the impacted artifact entity.

## Operational impact
- The gate runs the same logic in CI (`.github/workflows/scholarships-compatibility.yml`).
- Consumer mapping names the UI surfaces affected by a blocking change so reviewers see impact.
- The gate is advisory for additive changes and blocking for breaking changes without approval.

## Troubleshooting
- **Gate shows a blocking change you did not intend** — the artifact drift is real; fix the artifact or record
  an approval with the tracking issue. Do not disable the workflow.
- **Approval not recognized** — approval keys are stable strings of the form
  `<artifact>:<entity>:<reason>`; copy the exact key shown by the gate.