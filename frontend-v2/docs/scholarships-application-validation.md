# Scholarships Application Answers Validation and Word Limits

## Overview
The Scholarships Application Answers Validation engine provides unified, client-and-server parity for questionnaire responses. Before an application receipt is issued or reviewed by reviewers, student inputs are validated against rigorous constraints:

1. **Required Fields**: Empty or whitespace-only inputs are strictly rejected.
2. **Types**: Primitive constraints are enforced across text, rich text, numeric, currency (in minor units / cents), ISO-8601 calendar dates, booleans, and option sets.
3. **Option Sets**: Single-select and multi-select answers must strictly belong to the permitted options declared by the round schema; unknown or injected values are rejected.
4. **Lengths & Word Limits**:
   - Rich text personal statements and short answers enforce minimum and maximum word limits.
   - Word counts are computed after rich text normalization.
   - Accessible live meters warn students as they approach limits and announce status updates to screen readers.
5. **Dates**: Enforces `YYYY-MM-DD` ISO-8601 formatting and bounds (`minDate`, `maxDate`).
6. **Normalized Rich Text**: Strips malicious injection tags (`<script>`, `<iframe>`, `javascript:`, inline event handlers), normalizes unicode via NFKC, and collapses excessive line breaks.
7. **Safe Field Paths**: Validation errors identify safe, sanitized paths (e.g. `answers.personalStatement`, `answers.trackChoice`, `answers.focusAreas[0]`), avoiding raw internal pointer leakage.

## Ownership
- **Primary Owner**: Student Access & Admissions Engineering (`admissions-eng@chainverse.org`)
- **Secondary Owner**: Application Security (`appsec@chainverse.org`)
- **Stakeholders**: Scholarship Reviewers, Selection Committees, Sponsor Program Directors

Admissions Engineering governs questionnaire schemas, word limit thresholds, and field type definitions. Application Security audits the rich text normalization pipeline and XSS sanitization filters.

## Privacy
- **Sanitization & Redaction**:
  - Malformed content containing HTML tags, scripts, or non-printable control characters is sanitized on ingest.
  - Reviewers receive double-blinded, normalized text answers without identifying applicant metadata.
  - Cryptographic submission receipts exclude raw sensitive personal answers, recording only the content hash and statement word count.
- **Data Minimization**:
  - Only answers explicitly defined in the active round schema are collected and stored. Unknown fields submitted in the request body are discarded.

## Migration
- **Schema Evolution**:
  - Application form schemas are versioned (`version: "1.0.0"`).
  - Adding new optional fields does not invalidate existing in-progress drafts.
  - Round administrators can adjust word count ceilings between application cycles without breaking past submission receipts.
- **Rollback Strategy**:
  - If a schema deployment introduces an incorrect constraint, administrators can rollback to the prior schema version immediately without data loss.

## Operational impact
- **Parity Invariant**:
  - Client-side validation and server-side validation execute the exact same domain validation logic.
  - Client errors prevent wasted network roundtrips.
  - Server validation guarantees that tampered or direct API requests are rejected with the same safe error codes.
- **Service Level Indicators (SLIs)**:
  - Form validation response time: < 25ms locally, < 100ms over API.
  - Rich text normalization throughput: > 10,000 words/second.
- **Failure Recovery**:
  - In the event of a validation failure, the student's draft answers and word counts are preserved in local storage and form state so no text is lost.

## Troubleshooting
### Common Issues & Resolutions
1. **"Word limit exceeded"**:
   - *Cause*: The personal statement or essay response contains more words than the maximum allowed by the round.
   - *Resolution*: Condense the response until the word counter indicates compliance with the limit.
2. **"Selected option is invalid"**:
   - *Cause*: A selected value does not exist in the active option set (can occur if schema options changed while drafting).
   - *Resolution*: Re-select an available option from the dropdown or radio group.
3. **"Malformed content detected"**:
   - *Cause*: Input contains forbidden HTML, script tags, or non-printable control characters.
   - *Resolution*: Paste plain text into the editor. Rich text formatting will be automatically normalized into clean paragraphs.
4. **"Date is out of range"**:
   - *Cause*: The entered date is earlier than `minDate` or later than `maxDate`.
   - *Resolution*: Enter a valid date within the allowed program timeframe.
