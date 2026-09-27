# Scholarships Configurable Application Forms and Immutability

## Overview
The Configurable Application Forms architecture enables scholarship administrators and sponsor owners to design modular, versioned questionnaire workflows. Forms are composed of structured sections containing specialized field kinds:

- **Statements**: Personal motivation essays, study plans, research proposals with word limits and rich text formatting.
- **Questions**: Typed queries across text, numeric, currency, date, single-select, and multi-select formats.
- **Consents**: Mandatory and optional legal agreements, affirmative attestations, and sponsor data disclosure notices.
- **References**: Referee contact details, institutional email requirements, and letter submission requests.
- **Evidence**: Supporting document upload requirements (transcripts, income proofs, portfolios) with file size and format constraints.

### Core Architecture Invariants
1. **Published Schemas are Immutable**: Once published, a schema cannot be altered or deleted. Every edit requires creating a new draft version through semver-based forking (`patch`, `minor`, or `major`).
2. **Conditional Logic Validation**: Visual dependency graph validation ensures zero circular dependencies, eliminates forward references, and flags invalid target fields.
3. **Version-Bound Answers**: When a student completes an application, their answers are cryptographically bound to the specific schema ID, version number, and schema content hash (`schemaHash`). Submissions against mismatched or deprecated schemas are rejected.

## Ownership
- **Primary Owner**: Platform Engineering & Admissions Systems (`admissions-systems@chainverse.org`)
- **Secondary Owner**: Sponsor Operations (`sponsor-ops@chainverse.org`)
- **Stakeholders**: Scholarship Selection Committees, Legal & Compliance, Applicant Reviewers

Admissions Systems maintains the form schema parser, conditional dependency engine, and immutability seals. Sponsor Operations manages round-specific questionnaire compositions.

## Privacy
- **Consent Integrity**:
  - Consents defined in form schemas carry explicit version tags and legal policy URLs. When an applicant consents, the exact version string is recorded in the immutable submission audit log.
- **Selective Disclosure**:
  - Conditional logic prevents the unneeded collection of sensitive evidence (e.g. financial hardship records are only requested if the applicant affirmatively indicates financial need).
- **Redaction for Reviewers**:
  - Reviewers evaluate blinded statements and evidence without exposure to identifying demographic or contact attributes.

## Migration
- **Backwards Compatibility**:
  - Existing scholarship rounds continue serving their current schemas without disruption.
  - Answers submitted to schema `v1.0.0` remain retrievable and displayable using `v1.0.0` definitions even after `v2.0.0` is published.
- **Zero-Downtime Rollout**:
  - New schema versions can be drafted and tested in interactive preview mode while the currently published version actively accepts student submissions.
  - Switching an active round to a new schema version is atomic.

## Operational impact
- **Monitoring & Safety**:
  - Publishing triggers an automated conditional validation run. If circular dependencies are discovered, the publish transaction is aborted.
  - Cryptographic content hashes prevent silent database corruption or schema drift.
- **Service Level Indicators (SLIs)**:
  - Form schema retrieval: < 30ms.
  - Real-time conditional visibility recalculation: < 5ms per keystroke.
- **Failure Recovery**:
  - If a published schema requires corrections, operators can fork a `patch` version, adjust field text or guidelines, and publish within minutes.

## Troubleshooting
### Common Issues & Resolutions
1. **"Published schema is immutable"**:
   - *Cause*: Attempting to edit or delete fields on a schema that has already been published.
   - *Resolution*: Click "Fork New Draft", select a bump type (patch, minor, major), make edits in the new draft, and publish.
2. **"Circular conditional dependency detected"**:
   - *Cause*: Field A depends on Field B, which in turn depends on Field A (directly or transitively).
   - *Resolution*: Inspect the conditional rules and remove the loop. Dependent fields must form a directed acyclic graph.
3. **"Forward reference dependency detected"**:
   - *Cause*: A field conditionally depends on another field that appears after it in the form.
   - *Resolution*: Reorder the fields so the controlling question appears before the conditioned question.
4. **"Schema hash mismatch"**:
   - *Cause*: Answers were submitted against an altered or stale schema payload.
   - *Resolution*: Reload the application questionnaire to retrieve the current published schema version.
