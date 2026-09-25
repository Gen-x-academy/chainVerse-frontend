# Scholarship withdrawal documentation

## Ownership
- Product owner: ChainVerse education platform
- Engineering owner: frontend platform team
- Operations reviewer: scholarship program administrators

## Privacy and security
- Withdrawal records include a reason category and optional detail, but no sensitive applicant answers are duplicated into the withdrawal audit trail.
- Review history is intentionally preserved to maintain transparency and support compliance workflows.
- Capacity release is controlled by policy-aware rules so award commitments are not silently removed from program capacity.

## Migration
- The withdrawal flow is additive and does not mutate or erase the underlying application record.
- A future backend implementation should append withdrawal decisions to the existing application history rather than deleting review events.
- Accepted program terms and historical statuses remain retrievable even after a withdrawal is processed.

## Operational impact
- The UI falls back to local state when the API base URL is not configured.
- Program admins should monitor the `/scholarship-withdrawals` endpoint if real persistence is enabled.
- Any change in the policy impact rules should be reviewed with program operations before release.
