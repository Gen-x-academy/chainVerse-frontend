# Scholarships Sponsor Organizations and Verified Profiles

## Overview
The Sponsor Organizations and Verified Profiles architecture enables funding entities—such as charitable foundations, corporations, universities, DAOs, and individual benefactors—to register, customize, and verify their organizational identities on ChainVerse.

Key platform features include:
- **Verified Identity & Compliance Tiers**: Standardized tiers (`Tier 1 Standard`, `Tier 2 Enhanced`, and `Tier 3 Institutional`) validating legal incorporation, tax-exempt determinations (e.g. IRS 501(c)(3), UK Charity Commission), and authorized signatory resolutions.
- **Tenant-Scoped Organization Ownership**: Organizations belong strictly to tenant workspaces. Cross-tenant mutation and access is blocked by domain guard `assertTenantAccess`.
- **Contact Segregation & Zero Public Leakage**: Strict separation between public funding inquiry channels and private internal contacts (billing, disbursement, legal signatories, tax registration IDs). Private contacts are encrypted and never exposed on public directory listings or to student applicants.
- **Immutable Auditing**: Every status transition (requests, approvals, rejections, revocations, document submissions, and tier upgrades) is recorded in an immutable verification audit log.

## Ownership
- **Primary Owner**: Platform Engineering & Sponsor Operations (`sponsor-ops@chainverse.org`)
- **Secondary Owner**: Trust, Safety & Legal Compliance (`compliance@chainverse.org`)
- **Stakeholders**: Scholarship Selection Committees, Finance & Disbursements Operations, Student Access Office

Sponsor Operations maintains the organization registry and profile builder. Trust & Compliance audits credentials and adjudicates verification approvals.

## Privacy
- **Strict Contact Segregation**:
  - `PublicSponsorProfile` is the default output for public directories, search indexes, and student application journeys. It contains only public contact email, public website, verified badges, and branding.
  - `PrivateContactsCard` renders confidential billing, legal, and compliance data exclusively when `canViewPrivateContacts` returns true (tenant owners/finance managers of the same tenant or platform administrators).
- **Redaction of Sensitive Identifiers**:
  - Tax IDs (EIN, VAT), company registration numbers, and compliance document URLs are excluded from public API responses.
- **Data Minimization**:
  - Compliance documents are retained under least-privilege access rules, accessible only during active verification audits.

## Migration
- **Backwards Compatibility**:
  - Legacy sponsor records without extended profile attributes default to `unverified` status with `Tier 1 Standard` baseline.
  - Existing team memberships, invitations, and permissions remain fully functional and mapped directly to the organization's tenant workspace.
- **Zero-Downtime Rollout**:
  - Organizations can complete profile registration in `draft`/`unverified` mode and request verification asynchronously while maintaining live scholarship rounds.

## Operational impact
- **Audit Logging & Security Invariants**:
  - All verification reviews require authenticated administrator credentials and capture actor ID, timestamp, and audit notes.
  - Revocation of verification status is immediate and auditable, updating active badges and alerting tenant owners.
- **Service Level Indicators (SLIs)**:
  - Directory search and filtering response time: < 40ms.
  - Profile retrieval with contact sanitization: < 25ms.
  - Verification audit log query: < 35ms.
- **Failure Recovery**:
  - If a verification request is rejected, tenant owners receive actionable feedback in their audit log and can upload corrected documentation to request re-review.

## Troubleshooting
### Common Issues & Resolutions
1. **"Cross-tenant access violation"**:
   - *Cause*: Attempting to view or modify an organization owned by a different tenant workspace.
   - *Resolution*: Verify that your active session belongs to the organization's designated tenant ID or contact platform administrators for workspace transfers.
2. **"Private contacts redacted"**:
   - *Cause*: Viewer does not possess tenant owner, tenant finance, or platform administrator roles.
   - *Resolution*: Request an invitation with an appropriate role from the sponsor owner.
3. **"Verification is already pending review"**:
   - *Cause*: A verification request was already dispatched and is currently in the compliance officer review queue.
   - *Resolution*: Wait for review completion or upload supplemental credentials in the Compliance Documents tab.
4. **"Unauthorized: Verification review requires platform administrator privileges"**:
   - *Cause*: A non-admin user attempted to approve or reject a verification request.
   - *Resolution*: Verification adjudication is restricted to authorized platform compliance officers.
