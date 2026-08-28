import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepairTracking } from '../RepairTracking';
import type { RepairTicket } from '../RepairTracking';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeTickets = (): RepairTicket[] => [
  {
    id: 'repair-001',
    itemId: 'item-001',
    itemTitle: 'The Great Gatsby',
    issueDescription: 'Torn front cover',
    priority: 'medium',
    status: 'in-progress',
    createdAt: '2026-01-01T00:00:00Z',
    estimatedCost: 15.0,
    repairLogs: [],
    evidence: [],
  },
  {
    id: 'repair-002',
    itemId: 'item-002',
    itemTitle: 'Pride and Prejudice',
    issueDescription: 'Water damage',
    priority: 'high',
    status: 'scheduled',
    createdAt: '2026-01-02T00:00:00Z',
    estimatedCost: 25.0,
    repairLogs: [],
    evidence: [],
  },
];

function makeHandlers() {
  return {
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('RepairTracking — loading state', () => {
  it('renders skeleton placeholders while loading', () => {
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={[]}
        isLoading={true}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    // Expect at least one skeleton element to be present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('RepairTracking — error state', () => {
  it('renders the error message in a destructive alert', () => {
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={[]}
        error="Failed to load tickets"
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tickets');
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('RepairTracking — empty state', () => {
  it('shows "No repair tickets" and a create CTA', () => {
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking tickets={[]} onCreateTicket={onCreate} onUpdateTicket={onUpdate} />
    );

    expect(screen.getByText('No repair tickets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your first ticket/i })).toBeInTheDocument();
  });
});

// ─── Stats overview ───────────────────────────────────────────────────────────

describe('RepairTracking — stats overview', () => {
  it('shows correct counts per category', () => {
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // total
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });
});

// ─── Tab filtering ────────────────────────────────────────────────────────────

describe('RepairTracking — tab filtering', () => {
  it('shows only completed tickets on the Completed tab', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    await user.click(screen.getByRole('tab', { name: /completed/i }));

    await waitFor(() => {
      expect(screen.queryByText('The Great Gatsby')).not.toBeInTheDocument();
      expect(screen.queryByText('Pride and Prejudice')).not.toBeInTheDocument();
    });
  });

  it('restores all tickets when switching back to All tab', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    await user.click(screen.getByRole('tab', { name: /completed/i }));
    await user.click(screen.getByRole('tab', { name: /^all$/i }));

    await waitFor(() => {
      expect(screen.getByText('The Great Gatsby')).toBeInTheDocument();
      expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    });
  });
});

// ─── Create ticket ────────────────────────────────────────────────────────────

describe('RepairTracking — create ticket', () => {
  it('opens the creation modal on button click', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /new repair ticket/i }));

    expect(screen.getByText('Create New Repair Ticket')).toBeInTheDocument();
  });

  it('calls onCreateTicket with correct fields on submit', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /new repair ticket/i }));

    await user.type(screen.getByPlaceholderText(/enter item title/i), 'New Book');
    await user.type(screen.getByPlaceholderText(/describe the issue/i), 'Spine damage');

    await user.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ itemTitle: 'New Book', issueDescription: 'Spine damage' })
      );
    });
  });

  it('keeps the submit button disabled when required fields are empty', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking tickets={[]} onCreateTicket={onCreate} onUpdateTicket={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: /create your first ticket/i }));

    expect(screen.getByRole('button', { name: /create ticket/i })).toBeDisabled();
  });

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking tickets={[]} onCreateTicket={onCreate} onUpdateTicket={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: /create your first ticket/i }));
    expect(screen.getByText('Create New Repair Ticket')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create New Repair Ticket')).not.toBeInTheDocument();
    });
  });
});

// ─── Update ticket status ─────────────────────────────────────────────────────

describe('RepairTracking — update ticket', () => {
  it('calls onUpdateTicket when status is changed via select', async () => {
    const user = userEvent.setup();
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    // The first combobox in the table belongs to the first ticket
    const [firstStatus] = screen.getAllByRole('combobox');
    await user.click(firstStatus);
    await user.click(screen.getByRole('option', { name: /completed/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('repair-001', { status: 'completed' });
    });
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('RepairTracking — accessibility', () => {
  it('tabs have accessible names', () => {
    const { onCreate, onUpdate } = makeHandlers();
    render(
      <RepairTracking
        tickets={makeTickets()}
        onCreateTicket={onCreate}
        onUpdateTicket={onUpdate}
      />
    );

    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab).toHaveAccessibleName());
  });

  it('cost fields are hidden when estimatedCost is undefined (role restriction)', () => {
    const { onCreate, onUpdate } = makeHandlers();
    const ticketsNoCost = makeTickets().map(({ estimatedCost: _, ...t }) => t as RepairTicket);
    render(
      <RepairTracking tickets={ticketsNoCost} onCreateTicket={onCreate} onUpdateTicket={onUpdate} />
    );

    // "$" should not appear in cost cells
    const cells = screen.getAllByRole('cell');
    const costCells = cells.filter((c) => c.textContent?.includes('$'));
    expect(costCells).toHaveLength(0);
  });
});
