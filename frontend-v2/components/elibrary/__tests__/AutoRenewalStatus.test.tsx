import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AutoRenewalStatus, type LoanAutoRenewal, type AutoRenewalPreferences } from "../AutoRenewalStatus";

const mockLoans: LoanAutoRenewal[] = [
  {
    id: "loan-1",
    title: "Mastering Ethereum",
    eligible: true,
    enabled: true,
    nextEvaluationDate: "2026-09-01",
    currentDueDate: "2026-09-15",
    renewalsUsed: 1,
    maxRenewals: 3,
    lastOutcome: "success",
  },
  {
    id: "loan-2",
    title: "Solidity Patterns",
    eligible: true,
    enabled: false,
    nextEvaluationDate: "2026-09-05",
    currentDueDate: "2026-09-20",
    renewalsUsed: 0,
    maxRenewals: 2,
  },
  {
    id: "loan-3",
    title: "DeFi Handbook",
    eligible: false,
    enabled: false,
    nextEvaluationDate: "2026-09-10",
    currentDueDate: "2026-09-25",
    renewalsUsed: 3,
    maxRenewals: 3,
    lastOutcome: "failed",
    lastFailureReason: "Maximum renewals reached",
  },
];

const mockPrefs: AutoRenewalPreferences = {
  enabled: true,
  notifyBeforeRenewal: true,
  notifyOnFailure: false,
};

describe("AutoRenewalStatus", () => {
  it("renders loading state", () => {
    render(
      <AutoRenewalStatus loans={[]} preferences={mockPrefs} isLoading scope="account" />
    );
    expect(screen.getByLabelText("Loading auto-renewal status")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <AutoRenewalStatus loans={[]} preferences={mockPrefs} error="Timeout" scope="account" />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error loading auto-renewal status")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <AutoRenewalStatus loans={[]} preferences={mockPrefs} scope="account" />
    );
    expect(screen.getByText("No loans to manage auto-renewal for.")).toBeInTheDocument();
  });

  it("renders loan cards with correct titles", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    expect(screen.getByText("Mastering Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Solidity Patterns")).toBeInTheDocument();
    expect(screen.getByText("DeFi Handbook")).toBeInTheDocument();
  });

  it("displays renewal usage", () => {
    const { container } = render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    const loan1Card = container.querySelector('[data-loan-id="loan-1"]');
    expect(loan1Card).not.toBeNull();
    expect(loan1Card!.textContent).toContain("renewals used");
    expect(loan1Card!.textContent).toContain("3");
  });

  it("shows last outcome badges", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    expect(screen.getByText("Renewed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Maximum renewals reached")).toBeInTheDocument();
  });

  it("shows ineligible message for non-eligible loans", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    expect(
      screen.getByText(/Auto-renewal is not available for this item/)
    ).toBeInTheDocument();
  });

  it("shows max renewals reached message for ineligible loan at limit", () => {
    const { container } = render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    const loan3Card = container.querySelector('[data-loan-id="loan-3"]');
    expect(loan3Card).not.toBeNull();
    expect(loan3Card!.textContent).toContain("Maximum renewals reached");
    expect(loan3Card!.textContent).toContain("No further auto-renewals will be attempted");
  });

  it("renders toggle switches only for eligible loans", () => {
    render(
      <AutoRenewalStatus
        loans={mockLoans}
        preferences={mockPrefs}
        scope="account"
        onToggleLoan={vi.fn()}
      />
    );
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(1);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
  });

  it("renders preferences panel", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    expect(screen.getByText("Auto-Renewal Settings")).toBeInTheDocument();
    expect(screen.getByText("(applies to all loans)")).toBeInTheDocument();
  });

  it("shows loan scope label without account qualifier", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="loan" />
    );
    expect(screen.getByText("Auto-Renewal Settings")).toBeInTheDocument();
    expect(screen.queryByText("(applies to all loans)")).not.toBeInTheDocument();
  });

  it("renders preferences save button when onUpdate provided", () => {
    render(
      <AutoRenewalStatus
        loans={mockLoans}
        preferences={mockPrefs}
        scope="account"
        onUpdatePreferences={vi.fn()}
      />
    );
    expect(screen.getByText("Save preferences")).toBeInTheDocument();
  });

  it("does not render save button without onUpdate", () => {
    render(
      <AutoRenewalStatus loans={mockLoans} preferences={mockPrefs} scope="account" />
    );
    expect(screen.queryByText("Save preferences")).not.toBeInTheDocument();
  });
});
