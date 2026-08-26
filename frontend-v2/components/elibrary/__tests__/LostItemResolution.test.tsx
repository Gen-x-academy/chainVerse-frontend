import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LostItemResolution } from "../LostItemResolution";

const mockActivityHistory = [
  {
    id: "act-001",
    action: "Item marked as lost",
    user: "Test Librarian",
    timestamp: "2026-01-01T00:00:00Z",
    notes: "Item not returned",
  },
];

const requiresNotesFor = ["paid", "waived", "disputed"];
const patronConsequences = {
  found: ["Privileges reinstated"],
  paid: ["Payment received"],
  replaced: ["Item replaced"],
  waived: ["Fees waived"],
  disputed: ["Account suspended"],
};

const mockOnResolve = jest.fn().mockResolvedValue(undefined);

describe("LostItemResolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state correctly", () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        isLoading={true}
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    expect(screen.getAllByRole("status")).toHaveLength(3); // Skeleton loaders
  });

  it("renders error state correctly", () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        error="Failed to load resolution data"
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    expect(screen.getByText("Failed to load resolution data")).toBeInTheDocument();
  });

  it("prevents submission when notes are required but missing", async () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change status to "waived" which requires notes
    const waiveButton = screen.getByRole("button", { name: /waived/i });
    fireEvent.click(waiveButton);
    
    // Submit button should be disabled because notes are required
    const updateButton = screen.getByRole("button", { name: /update status/i });
    expect(updateButton).toBeDisabled();
    
    // Add notes
    const notesTextarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    fireEvent.change(notesTextarea, { target: { value: "Fees waived per library policy" } });
    
    // Button should now be enabled
    await waitFor(() => {
      expect(updateButton).not.toBeDisabled();
    });
  });

  it("shows patron consequences before submission when changing to status with consequences", async () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change to disputed status (which has consequences)
    const disputedButton = screen.getByRole("button", { name: /disputed/i });
    fireEvent.click(disputedButton);
    
    // Add required notes
    const notesTextarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    fireEvent.change(notesTextarea, { target: { value: "Dispute filed by patron" } });
    
    // Click to review consequences
    const submitButton = screen.getByRole("button", { name: /review consequences/i });
    fireEvent.click(submitButton);
    
    // Consequences should be visible
    await waitFor(() => {
      expect(screen.getByText("Account suspended")).toBeInTheDocument();
    });
    
    // Confirm submission
    const confirmButton = screen.getByRole("button", { name: /confirm and apply/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockOnResolve).toHaveBeenCalledWith("disputed", "Dispute filed by patron");
    });
  });

  it("adds new activity to resolution history after successful update", async () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change status to found
    const foundButton = screen.getByRole("button", { name: /found/i });
    fireEvent.click(foundButton);
    
    // Add notes
    const notesTextarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    fireEvent.change(notesTextarea, { target: { value: "Item found in returns" } });
    
    // Submit
    const updateButton = screen.getByRole("button", { name: /update status/i });
    fireEvent.click(updateButton);
    
    await waitFor(() => {
      expect(mockOnResolve).toHaveBeenCalled();
      // New activity should be in history
      expect(screen.getByText(/status updated to Found/i)).toBeInTheDocument();
    });
  });

  it("allows cancelling a status change before submission", async () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={mockActivityHistory}
        onResolve={mockOnResolve}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Start to change status
    const paidButton = screen.getByRole("button", { name: /paid/i });
    fireEvent.click(paidButton);
    
    // Then cancel
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    // Should be back to original status
    await waitFor(() => {
      expect(screen.getByText("Disputed")).toBeInTheDocument();
      expect(mockOnResolve).not.toHaveBeenCalled();
    });
  });
});