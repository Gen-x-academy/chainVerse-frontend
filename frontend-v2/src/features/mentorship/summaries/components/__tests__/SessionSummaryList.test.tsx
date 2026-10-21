import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionSummaryService } from "../../service";
import { SessionSummaryList } from "../SessionSummaryList";

vi.mock("../../service", () => ({ sessionSummaryService: { list: vi.fn() } }));

describe("SessionSummaryList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders deterministic session links and labels unconfirmed summaries", async () => {
    vi.mocked(sessionSummaryService.list).mockResolvedValue([
      {
        sessionId: "session-fixture-1",
        startsAt: "2026-10-20T10:00:00.000Z",
        counterpartName: "Mentor Fixture",
        summaryState: "draft",
      },
    ]);
    render(<SessionSummaryList />);
    expect(
      await screen.findByRole("link", {
        name: /view summary for session with mentor fixture/i,
      }),
    ).toHaveAttribute("href", "/mentorship/sessions/session-fixture-1/summary");
    expect(screen.getByText("Unconfirmed draft")).toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    vi.mocked(sessionSummaryService.list).mockResolvedValue([]);
    render(<SessionSummaryList />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      /no completed sessions/i,
    );
  });
});
