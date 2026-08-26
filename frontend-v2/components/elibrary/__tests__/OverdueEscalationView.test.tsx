import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OverdueEscalationView, type OverdueLoan } from "../OverdueEscalationView";

const mockLoans: OverdueLoan[] = [
  {
    id: "loan-1",
    title: "Introduction to Solidity",
    dueDate: "2026-08-10",
    daysOverdue: 15,
    escalationLevel: "warning",
    accountSummary: {
      totalOverdueItems: 3,
      totalFinesCents: 1500,
      accountStatus: "restricted",
    },
  },
  {
    id: "loan-2",
    title: "DeFi Deep Dive",
    dueDate: "2026-08-20",
    daysOverdue: 5,
    escalationLevel: "gentle",
  },
  {
    id: "loan-3",
    title: "Blockchain Basics",
    dueDate: "2026-07-01",
    daysOverdue: 55,
    escalationLevel: "critical",
  },
];

describe("OverdueEscalationView", () => {
  it("renders loading state with aria-busy", () => {
    render(<OverdueEscalationView loans={[]} isLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading overdue status")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<OverdueEscalationView loans={[]} error="Server error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error loading overdue status")).toBeInTheDocument();
  });

  it("renders empty state when no overdue loans", () => {
    render(<OverdueEscalationView loans={[]} />);
    expect(screen.getByText("All items are on track")).toBeInTheDocument();
    expect(screen.getByText("You have no overdue items.")).toBeInTheDocument();
  });

  it("renders overdue banners for each loan", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(screen.getByText("Introduction to Solidity")).toBeInTheDocument();
    expect(screen.getByText("DeFi Deep Dive")).toBeInTheDocument();
    expect(screen.getByText("Blockchain Basics")).toBeInTheDocument();
  });

  it("displays correct day counts", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("renders escalation level labels", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Reminder")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("displays account summary", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(screen.getByText("restricted")).toBeInTheDocument();
    expect(screen.getByText(/3 overdue items/)).toBeInTheDocument();
    expect(screen.getByText(/\$ 15.00 in outstanding fines/)).toBeInTheDocument();
  });

  it("renders escalation messages for non-none levels", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(
      screen.getByText(/This item is overdue\. Additional charges/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This item is due back soon/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This item is significantly overdue/)
    ).toBeInTheDocument();
  });

  it("does not show escalation message for none level", () => {
    const noEscalation: OverdueLoan[] = [
      {
        id: "loan-4",
        title: "On Time Book",
        dueDate: "2026-09-01",
        daysOverdue: 0,
        escalationLevel: "none",
      },
    ];
    render(<OverdueEscalationView loans={noEscalation} />);
    expect(screen.getByText("On Time Book")).toBeInTheDocument();
    expect(screen.queryByText("This item is due back soon")).not.toBeInTheDocument();
  });

  it("includes aria-labels for accessibility", () => {
    render(<OverdueEscalationView loans={mockLoans} />);
    expect(
      screen.getByLabelText(
        "Overdue: Introduction to Solidity, 15 days overdue"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Overdue: DeFi Deep Dive, 5 days overdue"
      )
    ).toBeInTheDocument();
  });
});
