import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RepairTracking } from "../RepairTracking";

const mockTickets = [
  {
    id: "repair-001",
    itemId: "item-001",
    itemTitle: "The Great Gatsby",
    issueDescription: "Torn front cover",
    priority: "medium" as const,
    status: "in-progress" as const,
    createdAt: "2026-01-01T00:00:00Z",
    estimatedCost: 15.00,
    repairLogs: [],
    evidence: [],
  },
  {
    id: "repair-002",
    itemId: "item-002",
    itemTitle: "Pride and Prejudice",
    issueDescription: "Water damage",
    priority: "high" as const,
    status: "scheduled" as const,
    createdAt: "2026-01-02T00:00:00Z",
    estimatedCost: 25.00,
    repairLogs: [],
    evidence: [],
  },
];

const mockCreateTicket = jest.fn().mockResolvedValue(undefined);
const mockUpdateTicket = jest.fn().mockResolvedValue(undefined);

describe("RepairTracking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders stats correctly with ticket counts", () => {
    render(
      <RepairTracking
        tickets={mockTickets}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    expect(screen.getByText("2")).toBeInTheDocument(); // Total repairs
    expect(screen.getByText("1")).toBeInTheDocument(); // In progress
    expect(screen.getByText("0")).toBeInTheDocument(); // Waiting for parts
    expect(screen.getByText("0")).toBeInTheDocument(); // Completed
  });

  it("renders empty state correctly when there are no tickets", () => {
    render(
      <RepairTracking
        tickets={[]}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    expect(screen.getByText("No repair tickets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first ticket/i })).toBeInTheDocument();
  });

  it("opens create ticket modal when new ticket button is clicked", async () => {
    render(
      <RepairTracking
        tickets={mockTickets}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    const newTicketButton = screen.getByRole("button", { name: /new repair ticket/i });
    fireEvent.click(newTicketButton);
    
    await waitFor(() => {
      expect(screen.getByText("Create New Repair Ticket")).toBeInTheDocument();
    });
  });

  it("creates a new repair ticket with required fields", async () => {
    render(
      <RepairTracking
        tickets={mockTickets}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /new repair ticket/i }));
    
    // Fill in required fields
    fireEvent.change(screen.getByPlaceholderText(/enter item title/i), {
      target: { value: "New Book" },
    });
    fireEvent.change(screen.getByPlaceholderText(/describe the issue/i), {
      target: { value: "Spine damage" },
    });
    
    // Submit
    const createButton = screen.getByRole("button", { name: /create ticket/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateTicket).toHaveBeenCalledWith(expect.objectContaining({
        itemTitle: "New Book",
        issueDescription: "Spine damage",
      }));
    });
  });

  it("updates ticket status when changed", async () => {
    render(
      <RepairTracking
        tickets={mockTickets}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    // Find the status select for the first ticket
    const statusSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(statusSelect, { target: { value: "completed" } });
    
    await waitFor(() => {
      expect(mockUpdateTicket).toHaveBeenCalledWith("repair-001", { status: "completed" });
    });
  });

  it("filters tickets by status when tabs are clicked", async () => {
    render(
      <RepairTracking
        tickets={mockTickets}
        onCreateTicket={mockCreateTicket}
        onUpdateTicket={mockUpdateTicket}
      />
    );
    
    // Click on "Completed" tab
    const completedTab = screen.getByRole("tab", { name: /completed/i });
    fireEvent.click(completedTab);
    
    await waitFor(() => {
      expect(screen.getByText("No tickets in this category.")).toBeInTheDocument();
    });
    
    // Click back to "All" tab
    const allTab = screen.getByRole("tab", { name: /all/i });
    fireEvent.click(allTab);
    
    await waitFor(() => {
      expect(screen.getByText("The Great Gatsby")).toBeInTheDocument();
      expect(screen.getByText("Pride and Prejudice")).toBeInTheDocument();
    });
  });
});