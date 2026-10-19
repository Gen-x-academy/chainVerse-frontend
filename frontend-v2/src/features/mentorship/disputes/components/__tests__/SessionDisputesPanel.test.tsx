import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDisputesPanel } from "../SessionDisputesPanel";
import { sessionDisputeService } from "../../service";
import type { SessionDisputeSnapshot } from "../../types";

vi.mock("../../service", () => ({
  SessionDisputeError: class SessionDisputeError extends Error {},
  sessionDisputeService: {
    load: vi.fn(),
    open: vi.fn(),
    respond: vi.fn(),
    resolve: vi.fn(),
  },
}));

const snapshot: SessionDisputeSnapshot = {
  tenantId: "tenant_test",
  sessions: [
    {
      publicId: "ses_001",
      completedAt: "2030-01-01T10:00:00.000Z",
      settlementStatus: "pending",
      canOpenDispute: true,
    },
  ],
  disputes: [],
};

const principal = {
  userId: "student_001",
  role: "student" as const,
  tenantId: "tenant_test",
};

describe("SessionDisputesPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes loading and actionable error states to assistive technology", async () => {
    vi.mocked(sessionDisputeService.load).mockRejectedValue(
      new Error("offline"),
    );
    render(<SessionDisputesPanel principal={principal} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /loading session disputes/i,
    );
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /dispute list could not be loaded.*check your connection/i,
    );
  });

  it("supports keyboard focus through the labeled dispute form", async () => {
    const user = userEvent.setup();
    vi.mocked(sessionDisputeService.load).mockResolvedValue(snapshot);
    render(<SessionDisputesPanel principal={principal} />);
    await screen.findByRole("button", {
      name: /open dispute and pause settlement/i,
    });

    await user.tab();
    expect(screen.getByLabelText("Session")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("What are you challenging?")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Description")).toHaveFocus();
  });

  it("does not load dispute records while the capability is disabled", () => {
    render(
      <SessionDisputesPanel principal={principal} capabilityState="disabled" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /not enabled in this environment/i,
    );
    expect(sessionDisputeService.load).not.toHaveBeenCalled();
  });

  it("opens a dispute with evidence references and confirms settlement is paused", async () => {
    vi.mocked(sessionDisputeService.load).mockResolvedValue(snapshot);
    vi.mocked(sessionDisputeService.open).mockResolvedValue({
      publicId: "dsp_001",
      sessionId: "ses_001",
      isOpenedByCurrentUser: true,
      issue: "attendance",
      summary: "The session did not take place.",
      evidenceReferences: ["evidence:ref-1"],
      status: "awaiting-response",
      openedAt: "2030-01-01T10:00:00.000Z",
      responseDeadlineAt: "2030-01-02T10:00:00.000Z",
      settlementStatus: "paused",
      permissions: { canRespond: false, canResolve: false },
    });

    render(<SessionDisputesPanel principal={principal} />);
    await screen.findByRole("button", {
      name: /open dispute and pause settlement/i,
    });
    fireEvent.change(screen.getByLabelText("Session"), {
      target: { value: "ses_001" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "The session did not take place." },
    });
    fireEvent.change(
      screen.getByLabelText(/evidence references, one per line/i),
      { target: { value: "evidence:ref-1" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /open dispute and pause settlement/i,
      }),
    );

    await waitFor(() =>
      expect(sessionDisputeService.open).toHaveBeenCalledWith(
        "tenant_test",
        {
          sessionId: "ses_001",
          issue: "attendance",
          summary: "The session did not take place.",
          evidenceReferences: ["evidence:ref-1"],
        },
        expect.stringContaining("mentor-067-"),
      ),
    );
    expect(
      await screen.findByText(/dispute opened.*settlement is paused/i),
    ).toBeInTheDocument();
  });

  it("keeps response controls unavailable to a participant after the deadline", async () => {
    vi.mocked(sessionDisputeService.load).mockResolvedValue({
      ...snapshot,
      sessions: [],
      disputes: [
        {
          publicId: "dsp_001",
          sessionId: "ses_001",
          isOpenedByCurrentUser: false,
          issue: "duration",
          summary: "Duration differs.",
          evidenceReferences: [],
          status: "awaiting-response",
          openedAt: "2030-01-01T10:00:00.000Z",
          responseDeadlineAt: "2030-01-01T11:00:00.000Z",
          settlementStatus: "paused",
          permissions: { canRespond: true, canResolve: false },
        },
      ],
    });
    render(
      <SessionDisputesPanel
        principal={principal}
        now={() => new Date("2030-01-01T12:00:00.000Z")}
      />,
    );
    await screen.findByText("Duration dispute · awaiting response");
    expect(
      screen.queryByRole("form", { name: /respond to session/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Settlement paused")).toBeInTheDocument();
  });

  it("lets a moderator resolve after a response and renders the audit reference", async () => {
    const pending = {
      ...snapshot,
      sessions: [],
      disputes: [
        {
          publicId: "dsp_review",
          sessionId: "ses_review",
          isOpenedByCurrentUser: false,
          issue: "outcome" as const,
          summary: "The agreed outcome was not delivered.",
          evidenceReferences: [],
          status: "under-review" as const,
          openedAt: "2030-01-01T10:00:00.000Z",
          responseDeadlineAt: "2030-01-02T10:00:00.000Z",
          response: {
            submittedAt: "2030-01-01T10:30:00.000Z",
            summary: "The mentor provided the agreed outcome.",
            evidenceReferences: [],
          },
          settlementStatus: "paused" as const,
          permissions: { canRespond: false, canResolve: true },
        },
      ],
    };
    const resolved = {
      ...pending.disputes[0],
      status: "resolved" as const,
      settlementStatus: "pending" as const,
      resolution: {
        decision: "confirm-completion" as const,
        rationale: "The response evidence confirms completion.",
        resolvedAt: "2030-01-01T11:00:00.000Z",
        auditEventId: "audit_mentor_067_1",
      },
    };
    vi.mocked(sessionDisputeService.load)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({
        ...pending,
        disputes: [resolved],
      });
    vi.mocked(sessionDisputeService.resolve).mockResolvedValue(resolved);

    render(
      <SessionDisputesPanel
        principal={{
          userId: "moderator_001",
          role: "moderator",
          tenantId: "tenant_test",
        }}
        now={() => new Date("2030-01-01T11:00:00.000Z")}
      />,
    );
    await screen.findByRole("button", { name: /record resolution/i });
    fireEvent.change(screen.getByLabelText("Resolution rationale"), {
      target: { value: "The response evidence confirms completion." },
    });
    fireEvent.click(screen.getByRole("button", { name: /record resolution/i }));

    await waitFor(() =>
      expect(sessionDisputeService.resolve).toHaveBeenCalledWith(
        "tenant_test",
        "dsp_review",
        {
          decision: "confirm-completion",
          rationale: "The response evidence confirms completion.",
        },
        expect.stringContaining("mentor-067-"),
      ),
    );
    expect(
      await screen.findByText("Audit reference: audit_mentor_067_1"),
    ).toBeInTheDocument();
  });
});
