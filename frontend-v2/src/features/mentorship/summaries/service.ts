import { apiClient } from "@/src/lib/api-client";
import { buildMentorshipEvent, trackMentorshipEvent } from "../analytics";
import type {
  SessionSummary,
  SessionSummaryDraftPayload,
  SessionSummaryListItem,
  SessionSummaryRecord,
} from "./types";

export type SessionSummaryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAVAILABLE";

export class SessionSummaryError extends Error {
  constructor(
    readonly code: SessionSummaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionSummaryError";
  }
}

const ERROR_MESSAGES: Record<SessionSummaryErrorCode, string> = {
  FORBIDDEN: "You are not a participant in this session.",
  NOT_FOUND: "This session or its summary is no longer available.",
  CONFLICT: "This summary changed elsewhere. Reload it before trying again.",
  UNAVAILABLE:
    "The session summary service is unavailable. Check your connection and retry.",
};

function stableError(error: unknown): SessionSummaryError {
  const message = error instanceof Error ? error.message : "";
  let responseCode = "";
  try {
    const parsed = JSON.parse(message) as { code?: unknown };
    responseCode = typeof parsed.code === "string" ? parsed.code : "";
  } catch {
    responseCode = "";
  }
  const code: SessionSummaryErrorCode =
    responseCode === "FORBIDDEN" || /\b(401|403)\b|forbidden/i.test(message)
      ? "FORBIDDEN"
      : responseCode === "NOT_FOUND" || /\b404\b|not found/i.test(message)
        ? "NOT_FOUND"
        : responseCode === "CONFLICT" || /\b409\b|conflict/i.test(message)
          ? "CONFLICT"
          : "UNAVAILABLE";
  return new SessionSummaryError(code, ERROR_MESSAGES[code]);
}

function sessionPath(sessionId: string): string {
  return `/mentorship/sessions/${encodeURIComponent(sessionId)}/summary`;
}

function trackSummaryEvent(
  stage: "session_summary_draft" | "session_summary_confirmed",
  sessionId: string,
): void {
  trackMentorshipEvent(
    buildMentorshipEvent(stage, sessionId, "session-summary-participant"),
  );
}

/** Only HTTP(S) links without embedded credentials may be rendered or sent. */
export function sanitizeSummaryUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export const sessionSummaryService = {
  async list(): Promise<SessionSummaryListItem[]> {
    try {
      return await apiClient.get<SessionSummaryListItem[]>(
        "/mentorship/sessions?status=completed",
      );
    } catch (error) {
      throw stableError(error);
    }
  },

  async get(sessionId: string): Promise<SessionSummaryRecord> {
    try {
      return await apiClient.get<SessionSummaryRecord>(sessionPath(sessionId));
    } catch (error) {
      throw stableError(error);
    }
  },

  async saveDraft(
    sessionId: string,
    payload: SessionSummaryDraftPayload,
  ): Promise<SessionSummary> {
    const safePayload: SessionSummaryDraftPayload = {
      expectedRevision: payload.expectedRevision,
      summaryText: payload.summaryText.trim(),
      decisions: payload.decisions.map((item) => item.trim()).filter(Boolean),
      resources: payload.resources.flatMap(({ label, url }) => {
        const safeUrl = sanitizeSummaryUrl(url);
        return safeUrl && label.trim()
          ? [{ label: label.trim(), url: safeUrl }]
          : [];
      }),
      nextSteps: payload.nextSteps.map((item) => item.trim()).filter(Boolean),
    };
    try {
      const saved = await apiClient.put<SessionSummary>(
        `${sessionPath(sessionId)}/draft`,
        safePayload,
        {
          headers: {
            "Idempotency-Key": `summary-draft-${encodeURIComponent(sessionId)}-${payload.expectedRevision}`,
          },
        },
      );
      trackSummaryEvent("session_summary_draft", sessionId);
      return saved;
    } catch (error) {
      throw stableError(error);
    }
  },

  async confirm(
    sessionId: string,
    expectedRevision: number,
  ): Promise<SessionSummary> {
    try {
      const confirmed = await apiClient.post<SessionSummary>(
        `${sessionPath(sessionId)}/confirm`,
        { expectedRevision },
        {
          headers: {
            "Idempotency-Key": `summary-confirm-${encodeURIComponent(sessionId)}-${expectedRevision}`,
          },
        },
      );
      trackSummaryEvent("session_summary_confirmed", sessionId);
      return confirmed;
    } catch (error) {
      throw stableError(error);
    }
  },
};
