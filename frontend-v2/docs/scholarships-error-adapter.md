# Scholarships typed error adapter and code normalization

- Audience: operators
- Owner: Platform engineering
- Code owner: `@Gen-x-academy/chainVerse-frontend`
- Issue: #1226

## Overview

All scholarship error responses across applications, awards, milestones, and disbursements are normalized through a single typed adapter: `src/features/scholarships/errors.ts`.

Previously, scholarship services and UI components handled a mixture of thrown raw strings, ad-hoc response objects, and varying backend shapes. Consequently, components were branching on English message strings (e.g. `err.message.includes('deadline')`), exposing internal backend details (such as database query syntax or stack traces) on unhandled 500s, and discarding server-provided request IDs needed for support tracing.

### Core Capabilities

1. **Stable Error Code Taxonomy**: Maps heterogeneous backend error payloads into strongly typed `ScholarshipErrorCode` values covering:
   - Application errors (`APPLICATION_DEADLINE_EXPIRED`, `APPLICATION_DUPLICATE`, `APPLICATION_ROUND_CLOSED`, `APPLICATION_INVALID_STATE`, `STATEMENT_REQUIRED`).
   - Award and agreement errors (`AWARD_ACCEPTANCE_DEADLINE_EXPIRED`, `AWARD_ALREADY_ACCEPTED`, `AWARD_ALREADY_DECLINED`, `AWARD_AGREEMENT_VERSION_MISMATCH`, `AWARD_DECLARATIONS_INCOMPLETE`, `AWARD_CANCELLED`).
   - Milestone and disbursement errors (`MILESTONE_ORDER_VIOLATION`, `DISBURSEMENT_ALREADY_PROCESSED`, `FUNDING_POOL_EXHAUSTED`, `AMOUNT_BELOW_MINIMUM`, `AMOUNT_ABOVE_MAXIMUM`, `IDEMPOTENCY_CONFLICT`, `LEDGER_DESYNCHRONIZATION`).
   - Identity, tenancy, and authorization errors (`UNAUTHENTICATED`, `UNAUTHORIZED`, `TENANT_MISMATCH`, `REVIEWER_CONFLICT`).
   - Concurrency and transport errors (`CONCURRENT_MODIFICATION`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `NETWORK_ERROR`, `INTERNAL_SERVER_ERROR`).

2. **English Message Branch Neutralization**: Predicates (`isScholarshipErrorCode`, `isAuthError`, `isTenancyError`, `isConcurrencyError`, `isValidationError`, `isRetryableError`) enable UI logic to react to error states strictly based on codes and categories, rather than locale-dependent free text.

3. **Safe User Messages**: Standard user-facing messages are mapped per error code. Any unhandled or sensitive text received from upstream servers is scrubbed before presentation to users.

4. **Support & Tracing Preserved**: Backend `requestId`, `traceId`, and `correlationId` properties are retained on `NormalizedScholarshipError.requestId` so users can quote them when seeking assistance.

5. **Structured Field Validation**: Nested `fieldErrors` and NestJS `class-validator` message arrays are parsed into a uniform array of `{ field, code, message }` items for form-level error highlighting.

## Ownership

- **Feature Area**: Scholarships & Financial Aid UI (`frontend-v2/src/features/scholarships`).
- **Owner Team**: Platform engineering (`@Gen-x-academy/chainVerse-frontend`).
- **Escalation**: For backend error schema changes or unmapped error codes, consult the Student Access and Policy Services team.

## Privacy

- **Sanitization of Server Internals**: The adapter actively filters out stack traces, database table/column identifiers, SQL syntax snippets, and environment credentials from user messages.
- **Tenancy Isolation**: Multi-tenant authorization failures resolve to `TENANT_MISMATCH` with generic organization boundary messages, preventing cross-tenant existence enumeration.
- **Support Identifiers**: Only opaque request IDs and public field paths (e.g. `answers.personalStatement`, `requestedAmountCents`) are preserved in error payloads.

## Migration

The error adapter is non-breaking and additive:
- Existing call sites receiving `ScholarshipApiError` can invoke `normalizeScholarshipError(err)` or use re-exported predicate helpers.
- `ScholarshipApiError` has been enriched to support optional `requestId` and `code` parameters while remaining 100% backwards-compatible with `(message: string, status: number)`.
- Re-exports in `src/features/scholarships/index.ts` allow feature consumers to import error utilities directly from the module root.

## Operational impact

- **Support Escalation Time**: Support engineers can directly query backend log aggregators using the user-provided `requestId` surfaced in error toasts and alert banners.
- **Consistent Telemetry**: Error analytics and monitoring dashboards group errors by stable `code` and `category` rather than unbounded, high-cardinality English error strings.
- **Retry Semantics**: Transient failures (`RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `LEDGER_DESYNCHRONIZATION`, `NETWORK_ERROR`) have `isRetryable = true`, enabling automated backoff and user retry actions.

## Troubleshooting

**An error code appears as `UNKNOWN_ERROR`.**
Verify whether the backend is returning a non-standard JSON payload or status code. If a new backend domain error code was introduced, add it to `BACKEND_CODE_MAP` in `src/features/scholarships/errors.ts`.

**A form does not highlight individual fields.**
Ensure the backend returns field-level errors as either `{ fieldErrors: [...] }`, `{ errors: [...] }`, or a string array under `message`. Inspect `normalized.fieldErrors` to verify parsed paths.

**User sees generic error instead of custom backend message.**
If the custom message contained sensitive patterns (such as SQL keywords, file paths, or stack frames), the sanitizer intentionally replaced it with the safe code-specific fallback message.
