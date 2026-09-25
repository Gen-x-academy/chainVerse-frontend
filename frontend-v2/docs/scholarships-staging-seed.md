# Scholarships staging and testnet seed flow

## Overview
Operators rehearse the decision, milestone, and payment pipelines in staging and on testnet using deterministic
synthetic seed runs. Each run is generated from a seed key, uses synthetic identity data only (never real
applicant PII), produces unique stable IDs, and records a rollback manifest of every created ID for a one-call,
reversible revoke.

## Ownership
- Seed flow design and determinism: Platform engineering.
- Staging environment and network cards: Platform engineering.
- Testnet wallet addresses: Platform engineering, with testnet asset confirmations from the peers.

## Privacy and synthetic identity
- Seed runs use synthetic names, regions, and income bands from fixed pools. No real applicant identifiers are
  read or written.
- Wallets generated for runs are testnet/staging-only addresses; asset flags are testnet and never promoted.
- Rollback manifests reference generated IDs only.

## Determinism and validation
- The same seed key and environment always regenerate the identical run ID and record set.
- Validation replays generation and fails when the run is not deterministic, IDs are not unique, wallet
  addresses are not valid 56-character Stellar testnet addresses, or relational references are broken.

## Reversibility
- Build a rollback manifest before applying a run. Revoke deletes nothing irreversibly: it marks the run revoked
  in one call and keeps the manifest for audit.
- Prefer fresh seed keys per rehearsal so runs can be compared and revoked independently.

## Migration
- Move from static demo data to seed runs once the policy service is available in staging.
- Keep the seed key and environment in the run record so any run can be reconstructed for support.

## Operational impact
- Seeding must never run against production; environment is an explicit field.
- Revoke alerts when a run is active for longer than its scheduled rehearsal window.

## Troubleshooting
- **Run fails validation** — generate again with a fresh seed key; validation surfaces the specific error.
- **Revoke missing IDs** — never hand-revoked a partial run; regenerate from the manifest and revoke the whole
  run.