import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DonationIntakeWorkflow } from "../DonationIntakeWorkflow";
import type { CatalogMatch } from "@/src/features/library/types/library.types";

const mockMatches: CatalogMatch[] = [
  {
    id: "bib-1",
    title: "Test Book",
    author: "Test Author",
    isbn: "9781234567890",
    matchScore: 0.95,
    existingCopies: 2,
  },
];

describe("DonationIntakeWorkflow", () => {
  it("renders loading state", () => {
    render(<DonationIntakeWorkflow isLoading />);
    expect(screen.getByLabelText("Loading donation intake")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<DonationIntakeWorkflow error="Service unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Error loading donation intake");
  });

  it("shows catalog matches before creating a new book", async () => {
    const user = userEvent.setup();
    const onSearchMatches = vi.fn();

    render(
      <DonationIntakeWorkflow
        matches={mockMatches}
        onSearchMatches={onSearchMatches}
        canViewDonorDetails
      />
    );

    await user.type(screen.getByLabelText("Donor name"), "Jane Donor");
    await user.type(screen.getByLabelText("Donor email"), "jane@example.com");
    await user.click(screen.getByText("Continue to book details"));

    await user.type(screen.getByLabelText("Book title"), "Test Book");
    await user.type(screen.getByLabelText("Book author"), "Test Author");
    await user.click(screen.getByText("Search catalog matches"));

    expect(onSearchMatches).toHaveBeenCalled();
    expect(screen.getByText("Catalog matching")).toBeInTheDocument();
    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText(/95% match/)).toBeInTheDocument();
  });

  it("requires rejection reason when rejecting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });

    render(
      <DonationIntakeWorkflow
        matches={[]}
        onSubmit={onSubmit}
        canViewDonorDetails
      />
    );

    await user.type(screen.getByLabelText("Donor name"), "Jane Donor");
    await user.click(screen.getByText("Continue to book details"));
    await user.type(screen.getByLabelText("Book title"), "Rejected Book");
    await user.type(screen.getByLabelText("Book author"), "Author");
    await user.click(screen.getByText("Search catalog matches"));
    await user.click(screen.getByText("Continue to decision"));

    await user.click(screen.getByRole("button", { name: "rejected" }));
    await user.click(screen.getByText("Submit intake"));

    expect(screen.getByRole("alert")).toHaveTextContent("A rejection reason is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("protects donor data when anonymous", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });

    render(
      <DonationIntakeWorkflow
        matches={[]}
        onSubmit={onSubmit}
        canViewDonorDetails
      />
    );

    await user.type(screen.getByLabelText("Donor name"), "Secret Donor");
    await user.type(screen.getByLabelText("Donor email"), "secret@example.com");
    await user.click(screen.getByLabelText(/Anonymous donation/));
    await user.click(screen.getByText("Continue to book details"));
    await user.type(screen.getByLabelText("Book title"), "Anonymous Gift");
    await user.type(screen.getByLabelText("Book author"), "Unknown");
    await user.click(screen.getByText("Search catalog matches"));
    await user.click(screen.getByText("Continue to decision"));
    await user.click(screen.getByRole("button", { name: "accepted" }));
    await user.click(screen.getByText("Submit intake"));

    await waitFor(() => {
      expect(screen.getByText(/Donor identity is protected/)).toBeInTheDocument();
    });
    expect(screen.queryByText("secret@example.com")).not.toBeInTheDocument();
  });
});
