import { apiClient } from "@/src/lib/api-client";
import { buildMentorshipEvent, trackMentorshipEvent } from "../analytics";
import type {
  OpenSessionDisputeInput,
  SessionDispute,
  SessionDisputeDecision,
  SessionDisputeSnapshot,
} from "./types";
import { SESSION_DISPUTE_ISSUES } from "./types";

export type SessionDisputeErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "DEADLINE_PASSED"
  | "CONFLICT"
  | "NETWORK"
  | "CONFIGURATION"
  | "INVALID_PAYLOAD";

const ERROR_MESSAGES: Record<SessionDisputeErrorCode, string> = {
  UNAUTHORIZED: "Your session has expired. Sign in again to continue.",
  FORBIDDEN: "Your role is not allowed to perform this dispute action.",
  DEADLINE_PASSED:
    "The response window has closed. The dispute is now ready for review.",
  CONFLICT:
    "This dispute changed before your action was saved. Refresh to see the latest status.",
  NETWORK:
    "The dispute service could not be reached. Check your connection and retry.",
  CONFIGURATION:
    "The dispute service is not configured. Contact support; retrying will not help.",
  INVALID_PAYLOAD:
    "The dispute service returned incomplete data. Contact support with the session reference.",
};

export class SessionDisputeError extends Error {
  constructor(public readonly code: SessionDisputeErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SessionDisputeError";
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>();

export function resetSessionDisputeRequestCache(): void {
  inFlightRequests.clear();
}

function requestError(error: unknown): SessionDisputeError {
  const message = error instanceof Error ? error.message : "";
  const code = message.match(/"code"\s*:\s*"([A-Z_]+)"/)?.[1];
  if (code && Object.hasOwn(ERROR_MESSAGES, code))
    return new SessionDisputeError(code as SessionDisputeErrorCode);
  if (/NEXT_PUBLIC_API_BASE_URL is not configured/i.test(message))
    return new SessionDisputeError("CONFIGURATION");
  if (/401|unauthorized|session expired/i.test(message))
    return new SessionDisputeError("UNAUTHORIZED");
  if (/403|forbidden/i.test(message))
    return new SessionDisputeError("FORBIDDEN");
  if (/410|deadline.?passed/i.test(message))
    return new SessionDisputeError("DEADLINE_PASSED");
  if (/409|conflict/i.test(message)) return new SessionDisputeError("CONFLICT");
  return new SessionDisputeError("NETWORK");
}

function invalidPayload(): never {
  throw new SessionDisputeError("INVALID_PAYLOAD");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDispute(value: unknown): SessionDispute {
  if (
    !isRecord(value) ||
    typeof value.publicId !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.isOpenedByCurrentUser !== "boolean" ||
    typeof value.summary !== "string" ||
    typeof value.openedAt !== "string" ||
    typeof value.responseDeadlineAt !== "string" ||
    !Array.isArray(value.evidenceReferences) ||
    !value.evidenceReferences.every(
      (reference) => typeof reference === "string",
    ) ||
    !SESSION_DISPUTE_ISSUES.includes(
      value.issue as (typeof SESSION_DISPUTE_ISSUES)[number],
    ) ||
    !["awaiting-response", "under-review", "escalated", "resolved"].includes(
      String(value.status),
    ) ||
    !Number.isFinite(Date.parse(value.openedAt)) ||
    !Number.isFinite(Date.parse(value.responseDeadlineAt)) ||
    !["pending", "paused", "settled", "refunded"].includes(
      String(value.settlementStatus),
    ) ||
    !isRecord(value.permissions) ||
    typeof value.permissions.canRespond !== "boolean" ||
    typeof value.permissions.canResolve !== "boolean"
  )
    invalidPayload();

  const active = value.status !== "resolved";
  if (active && value.settlementStatus !== "paused") invalidPayload();
  if (
    value.response !== undefined &&
    (!isRecord(value.response) ||
      typeof value.response.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(value.response.submittedAt)) ||
      typeof value.response.summary !== "string" ||
      !Array.isArray(value.response.evidenceReferences) ||
      !value.response.evidenceReferences.every(
        (reference) => typeof reference === "string",
      ))
  )
    invalidPayload();
  if (
    !active &&
    (!isRecord(value.resolution) ||
      !["confirm-completion", "refund", "partial-refund"].includes(
        String(value.resolution.decision),
      ) ||
      typeof value.resolution.rationale !== "string" ||
      typeof value.resolution.resolvedAt !== "string" ||
      !Number.isFinite(Date.parse(value.resolution.resolvedAt)) ||
      typeof value.resolution.auditEventId !== "string" ||
      !value.resolution.auditEventId)
  )
    invalidPayload();
  return value as unknown as SessionDispute;
}

export function normalizeSessionDisputeSnapshot(
  value: unknown,
  tenantId: string,
): SessionDisputeSnapshot {
  if (
    !isRecord(value) ||
    value.tenantId !== tenantId ||
    !Array.isArray(value.sessions) ||
    !Array.isArray(value.disputes)
  )
    invalidPayload();

  const sessions = value.sessions.map((session) => {
    if (
      !isRecord(session) ||
      typeof session.publicId !== "string" ||
      typeof session.completedAt !== "string" ||
      !Number.isFinite(Date.parse(session.completedAt)) ||
      session.settlementStatus !== "pending" ||
      typeof session.canOpenDispute !== "boolean"
    )
      invalidPayload();
    return session;
  });

  return {
    tenantId,
    sessions,
    disputes: value.disputes.map(normalizeDispute),
  } as SessionDisputeSnapshot;
}

function idempotent<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const request = operation().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, request);
  return request;
}

function requireMutationContext(
  tenantId: string,
  idempotencyKey: string,
): void {
  if (!tenantId || !idempotencyKey.trim())
    throw new SessionDisputeError("UNAUTHORIZED");
}

function trackDisputeEvent(
  disputeId: string,
  action: string,
  idempotencyKey: string,
): void {
  trackMentorshipEvent(
    buildMentorshipEvent(
      "session_dispute",
      `${disputeId}:${action}`,
      `actor:${idempotencyKey}`,
    ),
  );
}

export const sessionDisputeService = {
  load: async (tenantId: string): Promise<SessionDisputeSnapshot> => {
    if (!tenantId) throw new SessionDisputeError("UNAUTHORIZED");
    try {
      const payload = await apiClient.get<unknown>("/mentorship/disputes", {
        headers: { "X-Tenant-Id": tenantId },
      });
      return normalizeSessionDisputeSnapshot(payload, tenantId);
    } catch (error) {
      if (error instanceof SessionDisputeError) throw error;
      throw requestError(error);
    }
  },

  open: (
    tenantId: string,
    input: OpenSessionDisputeInput,
    idempotencyKey: string,
  ) => (
    requireMutationContext(tenantId, idempotencyKey),
    idempotent(idempotencyKey, async () => {
      try {
        const payload = await apiClient.post<unknown>(
          "/mentorship/disputes",
          input,
          {
            headers: {
              "X-Tenant-Id": tenantId,
              "Idempotency-Key": idempotencyKey,
            },
          },
        );
        const dispute = normalizeDispute(payload);
        if (
          dispute.sessionId !== input.sessionId ||
          dispute.settlementStatus !== "paused"
        )
          invalidPayload();
        trackDisputeEvent(dispute.publicId, "opened", idempotencyKey);
        return dispute;
      } catch (error) {
        if (error instanceof SessionDisputeError) throw error;
        throw requestError(error);
      }
    })
  ),

  respond: (
    tenantId: string,
    disputeId: string,
    input: { summary: string; evidenceReferences: string[] },
    idempotencyKey: string,
  ) => (
    requireMutationContext(tenantId, idempotencyKey),
    idempotent(idempotencyKey, async () => {
      try {
        const payload = await apiClient.post<unknown>(
          `/mentorship/disputes/${encodeURIComponent(disputeId)}/responses`,
          input,
          {
            headers: {
              "X-Tenant-Id": tenantId,
              "Idempotency-Key": idempotencyKey,
            },
          },
        );
        const dispute = normalizeDispute(payload);
        if (dispute.publicId !== disputeId || dispute.status === "resolved")
          invalidPayload();
        trackDisputeEvent(
          dispute.publicId,
          "response-submitted",
          idempotencyKey,
        );
        return dispute;
      } catch (error) {
        if (error instanceof SessionDisputeError) throw error;
        throw requestError(error);
      }
    })
  ),

  resolve: (
    tenantId: string,
    disputeId: string,
    input: { decision: SessionDisputeDecision; rationale: string },
    idempotencyKey: string,
  ) => (
    requireMutationContext(tenantId, idempotencyKey),
    idempotent(idempotencyKey, async () => {
      try {
        const payload = await apiClient.post<unknown>(
          `/mentorship/disputes/${encodeURIComponent(disputeId)}/resolution`,
          input,
          {
            headers: {
              "X-Tenant-Id": tenantId,
              "Idempotency-Key": idempotencyKey,
            },
          },
        );
        const dispute = normalizeDispute(payload);
        if (
          dispute.publicId !== disputeId ||
          dispute.status !== "resolved" ||
          !dispute.resolution?.auditEventId
        )
          invalidPayload();
        trackDisputeEvent(dispute.publicId, "resolved", idempotencyKey);
        return dispute;
      } catch (error) {
        if (error instanceof SessionDisputeError) throw error;
        throw requestError(error);
      }
    })
  ),
};
