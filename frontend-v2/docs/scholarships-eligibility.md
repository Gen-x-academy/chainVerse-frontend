# Scholarships eligibility rules

## Overview
Scholarship eligibility is configured as composable rule sets covering enrollment, course fit, academic score,
geography, income band, role, age, and custom attestation. Evaluation is deterministic, evidence collection is
minimized, and publication is blocked until a rule set validates cleanly.

## Ownership
- Product owner: Student Access team
- Engineering owner: Frontend platform and policy services
- Privacy partner: Data minimization review before any production publication

## Privacy and evidence minimization
- Only ask for the minimum data required to evaluate a rule.
- Treat income band, attestation prompts, and geography as sensitive evidence and request them only when necessary.
- Redact or summarize evidence when rendering results in the UI.
- Prefer attestation-based confirmations over collecting raw documents unless policy requires it.
- Store only achievement identifiers and award identifiers needed for prerequisite or exclusion checks.

## Publication validation
- Validation runs before a rule set is published and blocks publication when required fields are missing or invalid.
- Rule IDs must be unique and grade thresholds must stay within valid limits.
- The rule engine is deterministic so the same applicant snapshot always yields the same decision.
- Prerequisite dependencies use stable rule IDs and are rejected when they contain cycles or unknown references.
- Exclusions return stable reason codes such as `MUTUALLY_EXCLUSIVE_SCHOLARSHIP` and `PRIOR_AWARD_RESTRICTION`.

## Migration plan
- Start with a single default rule set and a fallback data object for local demos.
- Move any backend mappings behind the typed API client once the policy service is available.
- Retire mock data after the API contract is live and tested in staging.
- Migrate achievement and prior-award identifiers to the policy service without exposing raw award documents to the client.

## Operational impact
- This flow relies on a single source of truth for rule configuration and evaluation decisions.
- Alerting should trigger when rule validation fails or a publication attempt happens with errors.
- Monitor exclusion reason-code frequency to catch policy drift or unexpected award conflicts.
- Review policy changes with access and privacy stakeholders before rollout.

## Supporting documents
- Product owner: Student Access team. Storage and scanning owner: Platform security team.
- The API must issue short-lived, private upload sessions and store objects with server-managed encryption.
- The browser validates type and size before requesting an upload session; the API must repeat validation and scan every object before making it available.
- The client never displays a permanent public URL. Reviewers receive an authenticated, logged access path from the API.
- Upload, scan, rejection, and reviewer access events must be retained in the audit log according to the privacy retention policy.
- Migration should move the demo application identifier to the authenticated application context and preserve existing document metadata during backend adoption.

## Applicant consent
- Product owner: Student Access team. Policy-version owner: Privacy and Legal.
- Terms, privacy notice, data sharing, and sponsor disclosure are stored as versioned consent records.
- Acceptance is affirmative only, includes a server-validated timestamp, and is never inferred from page visits or pre-checked controls.
- A changed policy version requires fresh consent before the application can continue. Revocable consents use an authenticated revoke endpoint and retain the prior audit record.
- The API must reject client timestamps or consent versions that do not match its current policy, and must audit acceptance, re-consent, and revocation events.
- Migration should associate consent records with the authenticated applicant and application rather than the current demo application identifier.
