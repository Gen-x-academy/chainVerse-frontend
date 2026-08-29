import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StocktakeSessionView,
  clearPersistedStocktakeSessionId,
  loadPersistedStocktakeSessionId,
  persistActiveStocktakeSessionId,
} from "../StocktakeSession";
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

  it("announces a start failure", async () => {
    const user = userEvent.setup();
    render(
      <StocktakeSessionView
        nodes={mockNodes}
        session={null}
        onStartSession={vi.fn().mockResolvedValue({ success: false, error: "Not authorized to start stocktake" })}
      />
    );

    await user.selectOptions(screen.getByLabelText("Select branch"), "b1");
    await user.click(screen.getByText("Start stocktake session"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized to start stocktake");
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

    const onComplete = vi.fn().mockResolvedValue({ success: true, session: { ...sessionWithDiscrepancy, status: "closed" } });

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
    expect(screen.getByText("Stocktake session closed")).toBeInTheDocument();
  });

  it("stores only a resumable session reference, never a session snapshot", () => {
    persistActiveStocktakeSessionId(mockSession.id);

    expect(loadPersistedStocktakeSessionId()).toBe("st-1");
    expect(localStorage.getItem("elibrary-stocktake-session:st-1")).toBeNull();

    clearPersistedStocktakeSessionId();
    expect(loadPersistedStocktakeSessionId()).toBeNull();
  });

  it("uses the server session after an idempotent scan response", async () => {
    const user = userEvent.setup();
    const serverSession: StocktakeSession = {
      ...mockSession,
      scannedItems: [{ barcode: "9780000000001", title: "Server title", status: "found", scannedAt: "2026-08-26T10:01:00Z" }],
      discrepancies: [{ barcode: "9780000000002", title: "Book Two", type: "missing" }],
      status: "review",
    };
    const onScan = vi.fn().mockResolvedValue({ success: true, duplicate: true, session: serverSession });

    render(<StocktakeSessionView nodes={mockNodes} session={mockSession} onScan={onScan} />);
    await user.type(screen.getByLabelText(/barcode/i), "9780000000001");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onScan).toHaveBeenCalledWith("9780000000001"));
    expect(screen.getByText(/Duplicate scan/i)).toBeInTheDocument();
  });
});
