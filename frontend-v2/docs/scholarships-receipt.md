# Scholarships receipt documentation

## Ownership
- Product owner: ChainVerse education platform
- Engineering owner: frontend platform team
- Data privacy reviewer: compliance and trust team

## Privacy and security
- Receipts are intentionally limited to non-sensitive metadata: application ID, program version, submitted time, and integrity commitment.
- Sensitive answer content is excluded from the receipt payload and never persisted in the receipt record.
- The integrity commitment is derived from the canonical receipt fields so it can be independently verified without exposing applicant responses.

## Migration
- This feature adds a new scholarship submission flow without altering the current user authentication or course routes.
- Existing applications remain unaffected because the receipt is additive and stored in a separate client-side state record.
- If backend persistence is introduced later, the same canonical payload should be used to maintain stable receipts across migrations.

## Operational impact
- The frontend degrades gracefully when the API base URL is not configured by keeping the receipt generation local and deterministic.
- Operational teams should monitor the `/scholarships/applications` endpoint if production backend persistence is enabled.
- Any changes to the canonical receipt fields should be treated as a schema change and versioned via the program version field.
