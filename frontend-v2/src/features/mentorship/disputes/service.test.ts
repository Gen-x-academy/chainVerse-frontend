import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/src/lib/api-client";
import {
  resetSessionDisputeRequestCache,
  sessionDisputeService,
  SessionDisputeError,
} from "./service";

vi.mock("@/src/lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../analytics", () => ({
  buildMentorshipEvent: vi.fn(() => ({})),
  trackMentorshipEvent: vi.fn(),
}));

const input = {
  sessionId: "ses_001",
  issue: "attendance" as const,
  summary: "The session did not take place.",
  evidenceReferences: ["evidence:ref-1"],
};

const openedDispute = {
  publicId: "dsp_001",
  sessionId: "ses_001",
  isOpenedByCurrentUser: true,
  issue: "attendance",
  summary: input.summary,
  evidenceReferences: input.evidenceReferences,
  status: "awaiting-response",
  openedAt: "2030-01-01T10:00:00.000Z",
  responseDeadlineAt: "2030-01-02T10:00:00.000Z",
  settlementStatus: "paused",
  permissions: { canRespond: false, canResolve: false },
};

describe("sessionDisputeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionDisputeRequestCache();
  });

  it("rejects a snapshot from another tenant with a stable error", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      tenantId: "tenant_other",
      sessions: [],
      disputes: [],
    });
    await expect(
      sessionDisputeService.load("tenant_test"),
    ).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  it("shares concurrent retries and sends the same idempotency key", async () => {
    vi.mocked(apiClient.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          queueMicrotask(() => resolve(openedDispute));
        }),
    );

    const first = sessionDisputeService.open(
      "tenant_test",
      input,
      "mentor-067-stable-key",
    );
    const retry = sessionDisputeService.open(
      "tenant_test",
      input,
      "mentor-067-stable-key",
    );
    await expect(Promise.all([first, retry])).resolves.toEqual([
      openedDispute,
      openedDispute,
    ]);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith("/mentorship/disputes", input, {
      headers: {
        "X-Tenant-Id": "tenant_test",
        "Idempotency-Key": "mentor-067-stable-key",
      },
    });
  });

  it("rejects an open dispute without a settlement hold", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...openedDispute,
      settlementStatus: "pending",
    });
    await expect(
      sessionDisputeService.open("tenant_test", input, "mentor-067-no-hold"),
    ).rejects.toBeInstanceOf(SessionDisputeError);
    await expect(
      sessionDisputeService.open("tenant_test", input, "mentor-067-no-hold"),
    ).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });
});
