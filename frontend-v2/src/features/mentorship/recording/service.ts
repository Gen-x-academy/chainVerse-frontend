import { ApiClientError, apiClient } from "@/src/lib/api-client";
import type {
  RecordingConsentDecision,
  RecordingConsentScope,
  RecordingErrorCode,
  SessionRecordingConsent,
} from "./types";
import { providerReferenceIsOpaque } from "./domain";

const path = (sessionId: string) =>
  `/mentorship/sessions/${encodeURIComponent(sessionId)}/recording`;

export class RecordingConsentError extends Error {
  constructor(public readonly code: RecordingErrorCode) {
    super(recordingErrorMessage(code));
    this.name = "RecordingConsentError";
  }
}

export function recordingErrorMessage(code: RecordingErrorCode): string {
  switch (code) {
    case "ACCESS_DENIED":
      return "You are not authorized to manage recording for this session.";
    case "STATE_CONFLICT":
      return "The session changed before this action completed. Reload the session and try again.";
    default:
      return "The request could not be completed. Your choice was not confirmed; retry safely.";
  }
}

function toRecordingError(error: unknown): RecordingConsentError {
  const status =
    error instanceof ApiClientError
      ? error.status
      : error instanceof Error && error.message === "Session expired"
        ? 401
        : 0;
  if (status === 401 || status === 403)
    return new RecordingConsentError("ACCESS_DENIED");
  if (status === 409) return new RecordingConsentError("STATE_CONFLICT");
  return new RecordingConsentError("REQUEST_FAILED");
}

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validateSession(
  session: SessionRecordingConsent,
  expectedSessionId: string,
): SessionRecordingConsent {
  if (
    !session ||
    session.sessionId !== expectedSessionId ||
    !isOneOf(session.policy?.mode, ["prohibited", "optional", "required"]) ||
    !isOneOf(session.policy?.revocationPolicy, [
      "stop_immediately",
      "stop_at_session_end",
    ]) ||
    !Array.isArray(session.participants) ||
    !Number.isInteger(session.policy?.retentionDays) ||
    session.policy.retentionDays < 0 ||
    !Array.isArray(session.policy.accessRoles) ||
    !session.permissions ||
    typeof session.permissions.canConsent !== "boolean" ||
    typeof session.permissions.canStart !== "boolean" ||
    typeof session.permissions.canStop !== "boolean" ||
    !isOneOf(session.status, ["not_started", "recording", "stopped"]) ||
    !session.participants.every(
      (participant) =>
        typeof participant.participantId === "string" &&
        isOneOf(participant.role, ["mentor", "mentee", "guardian"]) &&
        typeof participant.isCurrentUser === "boolean" &&
        typeof participant.isMinor === "boolean" &&
        isOneOf(participant.consent, [
          "pending",
          "granted",
          "declined",
          "revoked",
        ]) &&
        typeof participant.guardianConsentRequired === "boolean" &&
        isOneOf(participant.guardianConsent, [
          "pending",
          "granted",
          "declined",
          "revoked",
          "not_required",
        ]),
    ) ||
    !(
      session.providerReference === null ||
      typeof session.providerReference === "string"
    ) ||
    !providerReferenceIsOpaque(session.providerReference)
  ) {
    throw new RecordingConsentError("REQUEST_FAILED");
  }
  return session;
}

async function request<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toRecordingError(error);
  }
}

export const sessionRecordingService = {
  get: (sessionId: string): Promise<SessionRecordingConsent> =>
    request(async () =>
      validateSession(
        await apiClient.get<SessionRecordingConsent>(path(sessionId)),
        sessionId,
      ),
    ),

  recordConsent: (
    sessionId: string,
    decision: RecordingConsentDecision,
    scope: RecordingConsentScope,
    idempotencyKey: string,
  ): Promise<SessionRecordingConsent> =>
    request(async () =>
      validateSession(
        await apiClient.post<SessionRecordingConsent>(
          `${path(sessionId)}/consents`,
          { decision, scope, idempotencyKey },
        ),
        sessionId,
      ),
    ),

  start: (
    sessionId: string,
    idempotencyKey: string,
  ): Promise<SessionRecordingConsent> =>
    request(async () =>
      validateSession(
        await apiClient.post<SessionRecordingConsent>(
          `${path(sessionId)}/start`,
          { idempotencyKey },
        ),
        sessionId,
      ),
    ),

  stop: (
    sessionId: string,
    idempotencyKey: string,
  ): Promise<SessionRecordingConsent> =>
    request(async () =>
      validateSession(
        await apiClient.post<SessionRecordingConsent>(
          `${path(sessionId)}/stop`,
          { idempotencyKey },
        ),
        sessionId,
      ),
    ),
};
