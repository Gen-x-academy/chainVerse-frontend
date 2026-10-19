import { describe, expect, it, vi } from "vitest";
import { ApiClientError, apiClient } from "@/src/lib/api-client";
import { RecordingConsentError, sessionRecordingService } from "../service";
import type { SessionRecordingConsent } from "../types";

vi.mock("@/src/lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const fixture: SessionRecordingConsent = {
  sessionId: "session-mentor-mentee-001",
  policy: {
    mode: "required",
    revocationPolicy: "stop_immediately",
    retentionDays: 14,
    accessRoles: ["mentor", "mentee"],
  },
  status: "not_started",
  participants: [
    {
      participantId: "mentee-001",
      role: "mentee",
      isCurrentUser: true,
      isMinor: false,
      consent: "pending",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
  ],
  providerReference: null,
  permissions: { canConsent: true, canStart: false, canStop: false },
};

describe("sessionRecordingService", () => {
  it("maps authorization and state conflicts to stable actionable codes", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(
      new ApiClientError(403, "private server detail"),
    );
    await expect(
      sessionRecordingService.get(fixture.sessionId),
    ).rejects.toMatchObject({
      name: "RecordingConsentError",
      code: "ACCESS_DENIED",
      message: "You are not authorized to manage recording for this session.",
    });

    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiClientError(409, "duplicate command detail"),
    );
    await expect(
      sessionRecordingService.start(fixture.sessionId, "retry-key"),
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message:
        "The session changed before this action completed. Reload the session and try again.",
    });
  });

  it("sends a scoped idempotent guardian decision and rejects a public media URL", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(fixture);
    await sessionRecordingService.recordConsent(
      fixture.sessionId,
      "grant",
      "guardian",
      "stable-retry-key",
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      `/mentorship/sessions/${fixture.sessionId}/recording/consents`,
      {
        decision: "grant",
        scope: "guardian",
        idempotencyKey: "stable-retry-key",
      },
    );

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...fixture,
      providerReference: "https://media.example/private.mp4",
    });
    await expect(
      sessionRecordingService.get(fixture.sessionId),
    ).rejects.toBeInstanceOf(RecordingConsentError);
  });

  it("rejects a mismatched session response before exposing its controls", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...fixture,
      sessionId: "another-session",
    });
    await expect(
      sessionRecordingService.get(fixture.sessionId),
    ).rejects.toMatchObject({
      name: "RecordingConsentError",
      code: "REQUEST_FAILED",
    });
  });
});
