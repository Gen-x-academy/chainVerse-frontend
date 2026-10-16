# Scholarship API error normalisation

Closes #1226. Source: `src/features/scholarships/lib/error-adapter.ts`.

## Why

Scholarship services and components handled a mix of thrown message strings and
ad hoc response shapes across applications, awards, milestones, and
disbursements. Behaviour differed per call site, some surfaces leaked raw server
text into the UI, and there was no consistent way to give support a reference.

## What this is

One pure, total adapter:

```ts
normalizeScholarshipError(error: unknown): NormalizedScholarshipError
```

It accepts anything — a `ScholarshipApiError`, a thrown `Error`, an `ApiError`
payload from `src/types/api.ts`, a raw JSON string, or an unknown value — and
always returns:

```ts
{
  code,          // stable ScholarshipErrorCode
  message,       // safe, display-only copy
  fieldErrors,   // [{ field, code, message }]
  requestId?,    // echoed from the server, never invented
  retryable,     // whether re-sending is meaningful
  httpStatus?,   // only when the failure was an HTTP response
}
```

## Codes

`VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `CROSS_TENANT`,
`NOT_FOUND`, `CONFLICT`, `DUPLICATE`, `DEADLINE_PASSED`, `FUNDING_SHORTFALL`,
`IDEMPOTENCY_REPLAY`, `CONCURRENCY_CONFLICT`, `RATE_LIMITED`, `SERVER_ERROR`,
`NETWORK`, `UNKNOWN`.

Resolution order: a recognised backend `code` wins; otherwise a network failure
becomes `NETWORK`; otherwise the HTTP status is mapped; otherwise `UNKNOWN`.

## Guarantees

- **No English branching.** UI logic switches on `code`; the `message` may be
  reworded freely.
- **Field errors are structured.** `scholarshipFieldErrorMap(error)` returns
  `{ field: message }` for a form library.
- **Sensitive detail is hidden.** `sanitizeServerDetail` strips HTML, stack
  frames, Windows/Unix paths, and secret-looking tokens, then caps the string at
  200 characters. Messages that reduce to nothing fall back to the canonical
  copy.
- **Unknown errors degrade consistently.** Every unrecognised value yields
  `UNKNOWN` with the same message.
- **Retries are explicit.** `retryable` is true for `NETWORK`, `RATE_LIMITED`,
  `SERVER_ERROR`, and `CONCURRENCY_CONFLICT`; a retry of those is safe because
  the backend write paths are idempotent (see ADR-001 invariant 8).

## Usage

```ts
try {
  await awardService.accept(awardId);
} catch (error) {
  const normalised = normalizeScholarshipError(error);
  setFormErrors(scholarshipFieldErrorMap(normalised));
  setBanner({ code: normalised.code, message: normalised.message });
  setSupportLine(scholarshipErrorSupportLine(normalised));
}
```

## Migration

- Additive: no service changes its return type; call sites opt in by wrapping
  `catch` blocks with `normalizeScholarshipError`.
- Existing `ScholarshipApiError` and `ApiError` shapes are understood as-is, so
  a call site can migrate without touching its service.

## Privacy and operations

- Raw server text is never rendered; only sanitised detail (and usually only the
  canonical message) reaches the user.
- `requestId`, when present, is the only value surfaced for support. It is
  carried through unchanged and never synthesised.

## Dependencies on other repositories

- **Backend** should return `{ code, message, requestId, errors[] }` on
  non-2xx responses. The adapter tolerates the previous shape meanwhile.
- **Contracts** own the backend code vocabulary; `CODE_MAP` is the frontend
  projection and should be extended when new codes are added.

## Verify

- `npx vitest run src/features/scholarships/lib/__tests__/error-adapter.test.ts`
  — code mapping, status fallback, JSON-in-message parsing, field errors,
  sanitisation, network/unknown degradation, and support lines.
- `npx tsc --noEmit`.
