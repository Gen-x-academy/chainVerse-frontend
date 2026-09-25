# Scholarship award budget documentation

## Ownership
- Product owner: ChainVerse education platform
- Engineering owner: frontend platform team
- Finance reviewer: funding operations and grants compliance

## Privacy and security
- Inventory values and reserve rules are operational configuration data and are not applicant personal data.
- Approval decisions are tracked without storing sensitive application answers.
- Remaining capacity is computed from inventory, allocated awards, and reserve rules so the funded decision remains authoritative.

## Migration
- This feature introduces budget controls as a new scholarship configuration layer without modifying existing applicant data structures.
- If backend persistence is introduced later, the same budget and reserve calculations should remain the source of truth for award capacity.
- Existing award history should be appended as a separate decision log rather than mutating previously approved records.

## Operational impact
- The frontend falls back to safe default values when a backend endpoint is unavailable.
- Finance teams should monitor the `/scholarship-awards` endpoint for operational changes and budget rule enforcement.
- Any new award policy or reserve rule should be versioned and reviewed before publication to avoid inventory drift.
