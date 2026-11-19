/**
 * Versioned capstone contracts (CAPSTONE-005).
 *
 * Schemas for commands, queries, events, pagination, dates, money, evidence
 * references, revisions and stable errors. They are backward compatible by
 * construction: unknown extra fields are tolerated on read (`looseObject`),
 * every envelope carries `schemaVersion`, and a newer major version is
 * reported explicitly instead of being parsed as if it were understood.
 */
import { z } from "zod";

export const CAPSTONE_CONTRACT_VERSION = 1 as const;

/** ISO 8601 instant in UTC, e.g. 2026-03-01T12:00:00Z (milliseconds optional). */
export const isoInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/, "must be an ISO 8601 UTC instant");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO 8601 date");

/** Money as integer minor units in a string (no floats), plus an ISO 4217-style currency code. */
export const money = z.object({
  amountMinor: z.string().regex(/^-?(0|[1-9][0-9]*)$/, "amountMinor must be an integer string"),
  currency: z.string().regex(/^[A-Z]{3,5}$/, "currency must be an uppercase code"),
});

export const publicId = z.string().regex(/^[a-z]{3}_[0-9A-HJKMNP-TV-Z]{16}$/, "invalid public id");

export const evidenceRef = z.object({
  id: publicId,
  kind: z.enum(["document", "dataset", "code", "link", "attestation"]),
  /** Content digest so evidence can be checked without storing it here. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(1).max(200),
});

export const revision = z.object({
  number: z.number().int().min(1),
  token: z.string().min(8).max(128),
  updatedAt: isoInstant,
});

export const errorCode = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "STALE_REVISION",
  "RATE_LIMITED",
  "UNAVAILABLE",
  "UNSUPPORTED_VERSION",
]);
export type ErrorCode = z.infer<typeof errorCode>;

export const apiError = z.looseObject({
  code: errorCode,
  message: z.string().min(1).max(500),
  retryable: z.boolean(),
  requestId: z.string().optional(),
  fieldErrors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiError>;

export const pageQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export function page<T extends z.ZodTypeAny>(item: T) {
  return z.looseObject({
    items: z.array(item),
    nextCursor: z.string().max(512).nullable(),
  });
}

export const commandEnvelope = z.looseObject({
  schemaVersion: z.number().int().min(1),
  requestId: z.string().min(8).max(100),
  type: z.string().min(1).max(100),
  expectedRevision: z.number().int().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
});

export const eventEnvelope = z.looseObject({
  schemaVersion: z.number().int().min(1),
  eventId: z.string().min(8).max(100),
  type: z.string().min(1).max(100),
  occurredAt: isoInstant,
  subject: publicId,
  /** Events never carry private payloads; only references and counters. */
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type ParseOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

function failure(code: ErrorCode, message: string, fieldErrors?: ApiError["fieldErrors"]): ParseOutcome<never> {
  return { ok: false, error: { code, message, retryable: false, ...(fieldErrors ? { fieldErrors } : {}) } };
}

/** Parse with a schema, returning a stable error shape instead of throwing. */
export function parseContract<S extends z.ZodTypeAny>(schema: S, input: unknown): ParseOutcome<z.infer<S>> {
  if (typeof input === "object" && input !== null && "schemaVersion" in input) {
    const version = (input as { schemaVersion: unknown }).schemaVersion;
    if (typeof version === "number" && version > CAPSTONE_CONTRACT_VERSION) {
      return failure("UNSUPPORTED_VERSION", `schemaVersion ${version} is newer than supported version ${CAPSTONE_CONTRACT_VERSION}`);
    }
  }
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return failure(
    "VALIDATION_FAILED",
    "The request did not match the expected shape.",
    result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  );
}
