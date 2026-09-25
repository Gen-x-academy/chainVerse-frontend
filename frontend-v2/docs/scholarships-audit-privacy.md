# Scholarships audit trail, data access, correction and erasure

## Overview

This surface covers four related capabilities:

- **Immutable audit trail** — security-relevant reads and every program, application, review, decision, award, milestone, and finance mutation are recorded as append-only, hash-chained events carrying actor, action, resource, outcome, request id, and safe change metadata (`issue #1156`).
- **Applicant data access and export** — applicants can request a machine-readable copy of their scholarship data and consent history. Exports authenticate strongly, run asynchronously, expire, exclude other users' private notes, and are audited (`issue #1154`).
- **Correction and erasure** — valid corrections and deletions are processed with tracked outcomes; lawful immutable financial and audit records are preserved, and denied requests carry a reason (`issue #1155`).
- **Sponsor and regulator audit exports** — scoped evidence packages covering governance, decisions, consent, funds, and payments, with strong authorization, redaction, integrity metadata, and expiry (`issue #1157`).

The surface lives at `/scholarships/audit`.

## Ownership

Platform engineering owns the audit chain and the export pipeline. The privacy office owns
correction and erasure decisions, and the Data Protection Officer signs off on the redaction rules.

## Privacy

Audit change metadata stores **redacted summaries and changed field names only** — never raw PII.
Personal data exports drop `reviewerNotes`, `internalComments`, and `otherApplicants`. Audit exports
only include records for applicants the viewer is authorized for; every other applicant id is listed
in `redactedApplicantIds`. Access to an export is limited to the applicant who requested it.

## Migration

Existing financial and audit records must be imported into the chain in chronological order so the
hash links remain intact. When backfilling legacy activity, insert events with their original
`occurredAt` timestamps and let `appendAuditEvent` compute sequence and hashes rather than
re-using legacy hashes.

## Operational impact

- **The trail is read-only** through the product API (`AUDIT_TRAIL_READ_ONLY`); any mutation of a stored event breaks `verifyAuditChain` and is surfaced immediately.
- **Exports expire**: personal data exports after `EXPORT_TTL_MS`, audit export packages after `AUDIT_EXPORT_TTL_MS`.
- **Integrity metadata**: `integrityHash` is deterministic for the same record set, so a package can be verified after delivery.
- **Erasure** always preserves `award`, `payment`, `audit-event`, and `consent-record` entries.
- **Denied requests** must record a denial reason for regulator review.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `verifyAuditChain` reports `brokenAt` | A stored event was edited or out of order | Restore the original event; never update in place |
| Export link returns 403 | Viewer is not the applicant | Re-authenticate as the applicant |
| Export link returns 410 | Export expired | Request a new export |
| Reviewer note leaked into an export | New field not added to `PRIVATE_EXPORT_FIELDS` | Add the field to the denylist |
| Regulator package blocked | Viewer role is not `regulator` | Use a regulator identity |
