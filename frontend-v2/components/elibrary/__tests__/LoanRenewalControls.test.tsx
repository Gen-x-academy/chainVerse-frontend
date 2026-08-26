import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LoanRenewalControls, type RenewalState } from "../LoanRenewalControls";

const mockLoans: RenewalState[] = [
  {
    id: "loan-1",
    title: "Mastering Ethereum",
    currentDueDate: "2026-09-15",
    newDueDatePreview: "2026-10-15",
    renewalsUsed: 1,
    maxRenewals: 3,
    isOverdue: false,
    canRenew: true,
  },
  {
    id: "loan-2",
    title: "Solidity Patterns",
    currentDueDate: "2026-08-20",
    renewalsUsed: 2,
    maxRenewals: 2,
    isOverdue: true,
    canRenew: false,
    blockReason: "max-renewals-reached",
    blockMessage: "You have used all available renewals for this item.",
  },
  {
    id: "loan-3",
    title: "DeFi Handbook",
    currentDueDate: "2026-09-25",
    newDueDatePreview: "2026-10-25",
    renewalsUsed: 0,
    maxRenewals: 1,
    isOverdue: false,
    canRenew: false,
    blockReason: "hold-pending",
    blockMessage: "Another patron has placed a hold on this item.",
  },
];

describe("LoanRenewalControls", () => {
  it("renders loading state", () => {
    render(<LoanRenewalControls loans={[]} isLoading />);
    expect(screen.getByLabelText("Loading renewal controls")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<LoanRenewalControls loans={[]} error="Service unavailable" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error loading loans")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<LoanRenewalControls loans={[]} />);
    expect(screen.getByText("No active loans to renew.")).toBeInTheDocument();
  });

  it("renders loan cards with titles", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText("Mastering Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Solidity Patterns")).toBeInTheDocument();
    expect(screen.getByText("DeFi Handbook")).toBeInTheDocument();
  });

  it("displays due dates", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText("2026-09-15")).toBeInTheDocument();
    expect(screen.getByText("2026-08-20")).toBeInTheDocument();
    expect(screen.getByText("2026-09-25")).toBeInTheDocument();
  });

  it("displays renewal usage", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText(/\/3 renewals used/)).toBeInTheDocument();
    expect(screen.getByText(/\/2 renewals used/)).toBeInTheDocument();
    expect(screen.getByText(/\/1 renewals used/)).toBeInTheDocument();
  });

  it("shows renewal preview date", () => {
    const { container } = render(<LoanRenewalControls loans={mockLoans} />);
    const loan1Card = container.querySelector('[data-loan-id="loan-1"]');
    expect(loan1Card).not.toBeNull();
    expect(loan1Card!.textContent).toContain("Renewal would extend due date to");
    expect(loan1Card!.textContent).toContain("2026-10-15");
  });

  it("shows overdue badge", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("renders renew button for eligible loans", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    const renewButtons = screen.getAllByText("Renew");
    expect(renewButtons).toHaveLength(1);
  });

  it("renders cannot-renew label for ineligible loans", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    const blocked = screen.getAllByText("Cannot renew");
    expect(blocked).toHaveLength(2);
  });

  it("shows block reason and message", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText("Maximum renewals reached")).toBeInTheDocument();
    expect(
      screen.getByText("You have used all available renewals for this item.")
    ).toBeInTheDocument();
    expect(screen.getByText("Item has a pending hold")).toBeInTheDocument();
    expect(
      screen.getByText("Another patron has placed a hold on this item.")
    ).toBeInTheDocument();
  });

  it("shows renewals remaining for eligible loans", () => {
    render(<LoanRenewalControls loans={mockLoans} />);
    expect(screen.getByText(/renewals? left/)).toBeInTheDocument();
  });

  it("calls onRenew when renew button clicked", async () => {
    const user = userEvent.setup();
    const onRenew = vi.fn().mockResolvedValue({ success: true, newDueDate: "2026-10-15" });
    render(<LoanRenewalControls loans={mockLoans} onRenew={onRenew} />);

    const renewBtn = screen.getByText("Renew");
    await user.click(renewBtn);

    expect(onRenew).toHaveBeenCalledWith("loan-1");
  });

  it("shows success message after renewal", async () => {
    const user = userEvent.setup();
    const onRenew = vi.fn().mockResolvedValue({ success: true, newDueDate: "2026-10-15" });
    render(<LoanRenewalControls loans={mockLoans} onRenew={onRenew} />);

    await user.click(screen.getByText("Renew"));

    await waitFor(() => {
      expect(screen.getByText("Renewed")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Successfully renewed/)
    ).toBeInTheDocument();
  });

  it("shows error message after failed renewal", async () => {
    const user = userEvent.setup();
    const onRenew = vi.fn().mockResolvedValue({ success: false, error: "Item has holds" });
    render(<LoanRenewalControls loans={mockLoans} onRenew={onRenew} />);

    await user.click(screen.getByText("Renew"));

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
    expect(screen.getByText("Item has holds")).toBeInTheDocument();
    expect(
      screen.getByText(/Your original due date \(2026-09-15\) is unchanged/)
    ).toBeInTheDocument();
  });

  it("shows error on exception", async () => {
    const user = userEvent.setup();
    const onRenew = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<LoanRenewalControls loans={mockLoans} onRenew={onRenew} />);

    await user.click(screen.getByText("Renew"));

    await waitFor(() => {
      expect(
        screen.getByText("An unexpected error occurred. Your original due date is unchanged.")
      ).toBeInTheDocument();
    });
  });

  it("prevents double-click during renewal", async () => {
    const user = userEvent.setup();
    let resolvePromise: (v: { success: boolean }) => void;
    const onRenew = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );
    render(<LoanRenewalControls loans={mockLoans} onRenew={onRenew} />);

    const renewBtn = screen.getByText("Renew");
    await user.click(renewBtn);
    expect(renewBtn).toBeDisabled();

    resolvePromise!({ success: true, newDueDate: "2026-10-15" });
    await waitFor(() => {
      expect(screen.getByText("Renewed")).toBeInTheDocument();
    });
  });
});
