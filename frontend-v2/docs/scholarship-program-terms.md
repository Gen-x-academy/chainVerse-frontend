# Scholarship program terms documentation

## Ownership
- Product owner: ChainVerse education platform
- Engineering owner: frontend platform team
- Compliance reviewer: trust and data privacy

## Privacy and security
- Only the version identifier, publication metadata, and integrity hash are exposed in the public program state.
- Applicant acceptance records store the terms version they accepted without duplicating sensitive answers or profiles.
- Immutable revisions are created as append-only records so prior versions remain available for reviews, audits, and applicant history.

## Migration
- This feature is additive and does not rewrite existing scholarship applications or stored user data.
- If the backend later stores accepted terms, the same version and integrity hash should remain the canonical source of truth.
- Any future change to the published terms should be appended as a new revision rather than editing the previous record.

## Operational impact
- The UI gracefully falls back to local mock data when the API base URL is not configured.
- Production observability should monitor the `/scholarship-programs` and `/scholarship-programs/accept` endpoints if persistence is enabled.
- Teams should treat version alterations as a product/legal change and re-review terms before publication.
