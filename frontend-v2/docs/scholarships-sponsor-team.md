# Scholarships Sponsor Team Membership and Invitations

## Overview
The Sponsor Team Membership and Invitations system provides decentralized scholarship sponsors with administrative governance over their organizations. Sponsor owners can securely invite colleagues into specialized, least-privilege operational roles:

- **Finance**: Handles payout batch execution, escrow settlement, refund issuance, and financial audit monitoring. Strictly excluded from application evaluation and criteria configuration.
- **Program**: Configures scholarship programs, application rounds, cohort scoping, eligibility rubrics, and milestone gates. Cannot execute funds disbursements.
- **Reviewer**: Participates in double-blind scoring rubrics for assigned applications. Strictly blinded from applicant PII, payout addresses, and administrative mutations.
- **Reporting**: Accesses aggregate impact metrics, conversion funnels, completion rates, and regulatory exports. Zero student PII access and no mutation permissions.

### Core Security Invariants
1. **Invitations Expire**: Every invitation is bound to an explicit expiration timestamp (default 7 days). Once expired, invitation tokens cannot be accepted. Sponsor owners can resend with a renewed expiration window.
2. **Single-Use Acceptance**: Invitation tokens are single-use cryptographic nonces. Once accepted (`consumedAt`), tokens cannot be replayed or reused.
3. **Audited Role Changes**: Any modification to a team member's role is recorded in the immutable audit trail with previous role, new role, actor identity, timestamp, and justification reason.
4. **Immediate Access Revocation**: When a team member is removed or suspended, access is immediately revoked (`canPerformSponsorAction` returns `allowed: false`). Active session tokens are invalidated without grace periods.

## Ownership
- **Primary Owner**: Platform Engineering & Sponsor Operations (`sponsor-ops@chainverse.org`)
- **Secondary Owner**: Security & Compliance (`security@chainverse.org`)
- **Stakeholders**: Scholarship Sponsors, Financial Custodians, Reviewer Committees

Team membership policies, role assignment rules, and token life-cycles are maintained by Sponsor Operations. Cryptographic nonce generation and token replay defenses are audited by the Security & Compliance team.

## Privacy
Data privacy is enforced by strict tenant isolation and role-scoped data masking:
- **Tenant Isolation**: Principal permissions are validated against `tenantId` (sponsor organization ID). Cross-tenant object access is immediately denied (`CROSS_TENANT_DENIED`).
- **PII Shielding**:
  - Reviewers only receive blinded application records without identifying personal details.
  - Reporting members only receive aggregated impact figures; individual student data points are omitted.
  - Invitation emails are retained solely for invitation delivery and membership association.
- **Consent and Audit Logs**:
  - Role modifications and removals generate audit events that redact sensitive personal information and log only operational change metadata.
  - Members have the right to request erasure upon account termination subject to legal financial retention mandates.

## Migration
- **Schema Compatibility**: Team membership and invitation schemas integrate alongside the core scholarships data layer without breaking legacy award or application tables.
- **Backwards Compatibility**: Existing sponsor accounts default to the `owner` role, retaining full governance. Additional team members invited post-launch are provisioned under their explicit least-privilege roles.
- **Rollback Strategy**:
  - If invitation delivery fails, pending invitations can be revoked or reissued without database rollbacks.
  - Removed members retain historical audit attribution while losing real-time mutation privileges.

## Operational impact
- **Monitoring & Alerts**:
  - High error rates on token acceptance trigger security alerts for potential token brute-force attempts.
  - Rate limiting is applied to invitation dispatches (maximum 20 invites per hour per sponsor) to prevent spam.
- **Service Level Indicators (SLIs)**:
  - Invitation validation response time: < 150ms at p99.
  - Immediate permission revocation propagation: < 100ms.
- **Disaster Recovery**:
  - Member records and invitation statuses are backed up continuously. In the event of an outage, pending invitations retain their original expiry timestamps.

## Troubleshooting
### Common Issues & Resolutions
1. **"Invitation Has Expired"**:
   - *Cause*: The recipient did not accept the invitation within the configured validity window.
   - *Resolution*: The sponsor owner can navigate to the "Invitations" tab and click "Resend" to issue a fresh token and extend expiration.
2. **"Invitation Already Used"**:
   - *Cause*: The single-use token was already consumed or replayed.
   - *Resolution*: The user is already registered as an active team member and should sign in directly.
3. **"Invitation Revoked"**:
   - *Cause*: The sponsor owner revoked the invitation prior to acceptance.
   - *Resolution*: Contact the sponsor owner if this was performed in error.
4. **"Removed Members Cannot Access Workspace"**:
   - *Cause*: Member status was changed to `removed`.
   - *Resolution*: Immediate revocation is working as designed. If reinstatement is required, the owner must reinvite the user.
