import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StocktakeSessionView } from "../StocktakeSession";
import type { LocationNode, StocktakeSession } from "@/src/features/library/types/library.types";

const mockNodes: LocationNode[] = [
  {
    id: "b1",
    label: "Main",
    level: "branch",
    active: true,
    children: [],
  },
];

const mockSession: StocktakeSession = {
  id: "st-1",
  location: { branchId: "b1" },
  locationLabel: "Main",
  startedAt: "2026-08-26T10:00:00Z",
  expectedItems: [
    { copyId: "c1", barcode: "9780000000001", title: "Book One" },
    { copyId: "c2", barcode: "9780000000002", title: "Book Two" },
  ],
  scannedItems: [],
  discrepancies: [],
  status: "active",
};

describe("StocktakeSessionView", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders loading state", () => {
    render(<StocktakeSessionView nodes={mockNodes} session={null} isLoading />);
    expect(screen.getByLabelText("Loading stocktake")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<StocktakeSessionView nodes={mockNodes} session={null} error="Session failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Session failed");
  });

  it("starts session at location step", () => {
    render(<StocktakeSessionView nodes={mockNodes} session={null} onStartSession={vi.fn()} />);
    expect(screen.getByText("Select stocktake location")).toBeInTheDocument();
  });

  it("shows scan progress when session is active", () => {
    render(<StocktakeSessionView nodes={mockNodes} session={mockSession} onScan={vi.fn()} />);
    expect(screen.getByText(/Progress: 0 \/ 2 found/)).toBeInTheDocument();
  });

  it("requires discrepancy review before closing", async () => {
    const user = userEvent.setup();
    const sessionWithDiscrepancy: StocktakeSession = {
      ...mockSession,
      discrepancies: [{ barcode: "9780000000002", title: "Book Two", type: "missing" }],
      status: "review",
    };

    const onComplete = vi.fn().mockResolvedValue({ success: true });

    render(
      <StocktakeSessionView
        nodes={mockNodes}
        session={sessionWithDiscrepancy}
        onScan={vi.fn()}
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/discrepancies require review/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Close session"));
    expect(screen.getByRole("alert")).toHaveTextContent("Review all discrepancies");
    expect(onComplete).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/I have reviewed all discrepancies/));
    await user.click(screen.getByText("Close session"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("persists session to localStorage", async () => {
    const user = userEvent.setup();
    const onStartSession = vi.fn().mockResolvedValue({ success: true, session: mockSession });

    render(
      <StocktakeSessionView nodes={mockNodes} session={null} onStartSession={onStartSession} />
    );

    await user.selectOptions(screen.getByLabelText("Select branch"), "b1");
    await user.click(screen.getByText("Start stocktake session"));

    await waitFor(() => {
      expect(localStorage.getItem("elibrary-stocktake-session:active")).toBe("st-1");
    });
  });
});
