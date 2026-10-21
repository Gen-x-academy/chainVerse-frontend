import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/src/lib/api-client";
import { trackMentorshipEvent } from "../../analytics";
import {
  sanitizeSummaryUrl,
  sessionSummaryService,
  SessionSummaryError,
} from "../service";

vi.mock("@/src/lib/api-client", () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));
vi.mock("../../analytics", () => ({
  buildMentorshipEvent: vi.fn(() => ({ stage: "session_summary" })),
  trackMentorshipEvent: vi.fn(),
}));

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const mockPost = vi.mocked(apiClient.post);

describe("sessionSummaryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sanitizes links to credential-free HTTP(S) URLs", () => {
    expect(sanitizeSummaryUrl(" https://example.test/guide ")).toBe(
      "https://example.test/guide",
    );
    expect(sanitizeSummaryUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeSummaryUrl("https://user:pass@example.test/")).toBeNull();
  });

  it("sends only shared fields and a stable idempotency key when saving", async () => {
    const saved = { id: "summary-1", sessionId: "session-1", state: "draft" };
    mockPut.mockResolvedValue(saved);

    await sessionSummaryService.saveDraft("session-1", {
      expectedRevision: 2,
      summaryText: "  Reviewed wallet security. ",
      decisions: [" Keep the signer offline. "],
      resources: [
        { label: "Guide", url: "https://example.test/guide" },
        { label: "Unsafe", url: "javascript:alert(1)" },
      ],
      nextSteps: [" Test multisig. "],
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/mentorship/sessions/session-1/summary/draft",
      {
        expectedRevision: 2,
        summaryText: "Reviewed wallet security.",
        decisions: ["Keep the signer offline."],
        resources: [{ label: "Guide", url: "https://example.test/guide" }],
        nextSteps: ["Test multisig."],
      },
      { headers: { "Idempotency-Key": "summary-draft-session-1-2" } },
    );
    expect(JSON.stringify(mockPut.mock.calls[0][1])).not.toMatch(
      /privateNotes/i,
    );
    expect(trackMentorshipEvent).toHaveBeenCalledTimes(1);

    await sessionSummaryService.saveDraft("session-1", {
      expectedRevision: 2,
      summaryText: "Reviewed wallet security.",
      decisions: [],
      resources: [],
      nextSteps: [],
    });
    expect(mockPut.mock.calls[1][2]).toEqual({
      headers: { "Idempotency-Key": "summary-draft-session-1-2" },
    });
  });

  it("confirms explicitly with a revision-scoped idempotency key", async () => {
    mockPost.mockResolvedValue({ id: "summary-1", state: "confirmed" });
    await sessionSummaryService.confirm("session-1", 3);
    expect(mockPost).toHaveBeenCalledWith(
      "/mentorship/sessions/session-1/summary/confirm",
      { expectedRevision: 3 },
      { headers: { "Idempotency-Key": "summary-confirm-session-1-3" } },
    );
    expect(trackMentorshipEvent).toHaveBeenCalledTimes(1);
  });

  it("maps authorization failures to stable actionable errors", async () => {
    mockGet.mockRejectedValue(new Error('{"code":"FORBIDDEN"}'));
    await expect(sessionSummaryService.get("session-1")).rejects.toMatchObject<
      Partial<SessionSummaryError>
    >({
      code: "FORBIDDEN",
      message: "You are not a participant in this session.",
    });
  });
});
