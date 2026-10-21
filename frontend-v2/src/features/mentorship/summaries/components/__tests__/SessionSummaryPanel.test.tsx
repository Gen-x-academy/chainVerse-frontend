import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionSummaryService } from "../../service";
import type { SessionSummaryRecord } from "../../types";
import { SessionSummaryPanel } from "../SessionSummaryPanel";

vi.mock("../../service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../service")>();
  return {
    ...actual,
    sessionSummaryService: {
      get: vi.fn(),
      saveDraft: vi.fn(),
      confirm: vi.fn(),
    },
  };
});

const record: SessionSummaryRecord = {
  sessionId: "session-fixture-1",
  mentorId: "mentor-fixture-1",
  menteeId: "student-fixture-1",
  summary: null,
};

const mockGet = vi.mocked(sessionSummaryService.get);
const mockSave = vi.mocked(sessionSummaryService.saveDraft);
const mockConfirm = vi.mocked(sessionSummaryService.confirm);

describe("SessionSummaryPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("provides an accessible loading state and then a labeled draft form", async () => {
    mockGet.mockResolvedValue(record);
    render(
      <SessionSummaryPanel
        sessionId={record.sessionId}
        currentUserId={record.mentorId}
        role="mentor"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading session summary/i,
    );
    expect(
      await screen.findByRole("textbox", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Decisions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Resources" }),
    ).toHaveAccessibleDescription(/label.*https/i);
    expect(screen.getByText("Unconfirmed")).toBeInTheDocument();
    expect(screen.queryByLabelText(/private notes/i)).not.toBeInTheDocument();
  });

  it("saves a shared draft and requires edits to be saved before confirmation", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(record);
    mockSave.mockResolvedValue({
      id: "summary-fixture-1",
      sessionId: record.sessionId,
      state: "draft",
      authorId: record.mentorId,
      updatedBy: record.mentorId,
      revision: 1,
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
      summaryText: "Reviewed wallet security.",
      decisions: ["Keep the signer offline."],
      resources: [{ label: "Guide", url: "https://example.test/guide" }],
      nextSteps: ["Test multisig."],
    });
    mockConfirm.mockResolvedValue({
      id: "summary-fixture-1",
      sessionId: record.sessionId,
      state: "confirmed",
      authorId: record.mentorId,
      updatedBy: record.mentorId,
      revision: 1,
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
      confirmedBy: record.menteeId,
      confirmedAt: "2026-10-20T11:00:00.000Z",
      summaryText: "Reviewed wallet security.",
      decisions: ["Keep the signer offline."],
      resources: [{ label: "Guide", url: "https://example.test/guide" }],
      nextSteps: ["Test multisig."],
    });
    render(
      <SessionSummaryPanel
        sessionId={record.sessionId}
        currentUserId={record.mentorId}
        role="mentor"
      />,
    );

    await user.type(
      await screen.findByRole("textbox", { name: "Summary" }),
      "Reviewed wallet security.",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Decisions" }),
      "Keep the signer offline.",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Resources" }),
      "Guide | javascript:alert(1)",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /valid http or https/i,
    );
    expect(mockSave).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("textbox", { name: "Resources" }));
    await user.type(
      screen.getByRole("textbox", { name: "Resources" }),
      "Guide | https://example.test/guide",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        record.sessionId,
        expect.objectContaining({
          summaryText: "Reviewed wallet security.",
          resources: [{ label: "Guide", url: "https://example.test/guide" }],
          expectedRevision: 0,
        }),
      ),
    );
    expect(await screen.findByText(/draft saved/i)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", {
      name: "Confirm summary",
    });
    expect(confirmButton).toBeEnabled();
    await user.type(
      screen.getByRole("textbox", { name: "Summary" }),
      " More context.",
    );
    expect(confirmButton).toBeDisabled();
    expect(
      screen.getByText(/save your edits before confirming/i),
    ).toHaveAttribute("role", "status");
    await user.clear(screen.getByRole("textbox", { name: "Summary" }));
    await user.type(
      screen.getByRole("textbox", { name: "Summary" }),
      "Reviewed wallet security.",
    );
    await user.click(confirmButton);
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith(record.sessionId, 1);
  });

  it("denies a signed-in nonparticipant and provides retry for load errors", async () => {
    mockGet.mockResolvedValue(record);
    const { rerender } = render(
      <SessionSummaryPanel
        sessionId={record.sessionId}
        currentUserId="outsider"
        role="student"
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not a participant/i,
    );

    mockGet.mockRejectedValueOnce(
      new Error(
        "The session summary service is unavailable. Check your connection and retry.",
      ),
    );
    rerender(
      <SessionSummaryPanel
        sessionId="session-fixture-2"
        currentUserId={record.mentorId}
        role="mentor"
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /service is unavailable/i,
    );
    expect(
      screen.getByRole("button", { name: "Retry loading summary" }),
    ).toBeEnabled();
  });

  it("renders server-provided summary links only when they pass sanitization", async () => {
    mockGet.mockResolvedValue({
      ...record,
      summary: {
        id: "summary-1",
        sessionId: record.sessionId,
        state: "confirmed",
        authorId: record.mentorId,
        updatedBy: record.menteeId,
        revision: 2,
        createdAt: "2026-10-20T10:00:00.000Z",
        updatedAt: "2026-10-20T10:10:00.000Z",
        confirmedBy: record.menteeId,
        confirmedAt: "2026-10-20T10:20:00.000Z",
        summaryText: "Reviewed the account model.",
        decisions: [],
        nextSteps: [],
        resources: [
          { label: "Guide", url: "https://example.test/guide" },
          { label: "Unsafe", url: "javascript:alert(1)" },
        ],
      },
    });
    render(
      <SessionSummaryPanel
        sessionId={record.sessionId}
        currentUserId={record.mentorId}
        role="mentor"
      />,
    );
    const link = await screen.findByRole("link", { name: "Guide" });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(
      screen.queryByRole("link", { name: "Unsafe" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/last edited by/i)).toHaveTextContent(
      record.menteeId,
    );
  });
});
