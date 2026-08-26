import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ItemConditionReport } from "../ItemConditionReport";

const mockReport = {
  itemId: "item-001",
  title: "The Great Gatsby",
  currentCondition: "good" as const,
  repairStatus: "not-needed" as const,
  notes: "Initial notes",
  evidence: [],
  activityHistory: [
    {
      id: "act-001",
      action: "Item added to inventory",
      user: "Test Librarian",
      timestamp: "2026-01-01T00:00:00Z",
    },
  ],
};

const requiresNotesFor = ["damaged", "lost", "in-repair"];
const patronConsequences = {
  good: [],
  worn: [],
  damaged: ["Patron will be charged a damage fee"],
  lost: ["Patron will be charged replacement cost"],
  "in-repair": [],
};

const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

describe("ItemConditionReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state correctly", () => {
    render(
      <ItemConditionReport
        report={mockReport}
        isLoading={true}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    expect(screen.getAllByRole("status")).toHaveLength(3); // Skeleton loaders
  });

  it("renders error state correctly", () => {
    render(
      <ItemConditionReport
        report={mockReport}
        error="Failed to load report"
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    expect(screen.getByText("Failed to load report")).toBeInTheDocument();
  });

  it("renders empty state correctly when no report is provided", () => {
    // @ts-expect-error - Testing null case
    render(
      <ItemConditionReport
        report={null}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    expect(screen.getByText("No report found")).toBeInTheDocument();
  });

  it("prevents submission when notes are required but missing", async () => {
    render(
      <ItemConditionReport
        report={mockReport}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change condition to damaged which requires notes
    const conditionSelect = screen.getByRole("combobox", { name: /condition/i });
    fireEvent.change(conditionSelect, { target: { value: "damaged" } });
    
    // Try to submit without notes
    const submitButton = screen.getByRole("button", { name: /update condition/i });
    expect(submitButton).toBeDisabled();
    
    // Add notes
    const notesTextarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    fireEvent.change(notesTextarea, { target: { value: "Item has significant damage" } });
    
    // Button should now be enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("shows patron consequences before submission when they exist", async () => {
    render(
      <ItemConditionReport
        report={mockReport}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change to lost status which has consequences
    const conditionSelect = screen.getByRole("combobox", { name: /condition/i });
    fireEvent.change(conditionSelect, { target: { value: "lost" } });
    
    // Add required notes
    const notesTextarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    fireEvent.change(notesTextarea, { target: { value: "Item is lost" } });
    
    // Click submit to see consequences
    const submitButton = screen.getByRole("button", { name: /review consequences/i });
    fireEvent.click(submitButton);
    
    // Consequences should be visible
    await waitFor(() => {
      expect(screen.getByText("Patron will be charged replacement cost")).toBeInTheDocument();
    });
    
    // Confirm submission
    const confirmButton = screen.getByRole("button", { name: /confirm and apply/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it("adds new activity to history after successful submission", async () => {
    render(
      <ItemConditionReport
        report={mockReport}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Change condition and add notes
    const conditionSelect = screen.getByRole("combobox", { name: /condition/i });
    fireEvent.change(conditionSelect, { target: { value: "worn" } });
    
    const notesTextarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    fireEvent.change(notesTextarea, { target: { value: "Item is showing wear" } });
    
    // Submit
    const submitButton = screen.getByRole("button", { name: /update condition/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      // New activity should be in the history
      expect(screen.getByText(/status updated to Worn/i)).toBeInTheDocument();
    });
  });

  it("allows attaching and removing evidence files", async () => {
    render(
      <ItemConditionReport
        report={mockReport}
        onSubmit={mockOnSubmit}
        requiresNotesForStatus={requiresNotesFor}
        patronConsequences={patronConsequences}
      />
    );
    
    // Simulate file upload
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByLabelText(/click to upload or drag and drop/i).querySelector('input[type="file"]');
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }
    
    await waitFor(() => {
      expect(screen.getByText("test.jpg")).toBeInTheDocument();
    });
    
    // Remove the file
    const removeButton = screen.getByRole("button", { name: "" }); // X button
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(screen.queryByText("test.jpg")).not.toBeInTheDocument();
    });
  });
});