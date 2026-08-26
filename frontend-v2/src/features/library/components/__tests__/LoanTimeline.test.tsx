import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoanTimeline } from '../LoanTimeline';
import type { LoanTimelineEvent } from '../../types/loan.types';

const mockEvents: LoanTimelineEvent[] = [
  {
    id: 'evt-1',
    type: 'checkout',
    bookTitle: 'Structure and Interpretation of Computer Programs',
    bookId: 'book-1',
    timestamp: '2026-08-01T10:00:00Z',
    immutable: true,
  },
  {
    id: 'evt-2',
    type: 'due_date',
    bookTitle: 'Structure and Interpretation of Computer Programs',
    bookId: 'book-1',
    timestamp: '2026-08-15T23:59:00Z',
    details: 'Due date reminder sent',
    immutable: true,
  },
  {
    id: 'evt-3',
    type: 'renewal',
    bookTitle: 'Structure and Interpretation of Computer Programs',
    bookId: 'book-1',
    timestamp: '2026-08-10T14:30:00Z',
    librarian: 'Jane Smith',
    immutable: true,
  },
];

describe('LoanTimeline', () => {
  it('renders loading state', () => {
    render(<LoanTimeline events={[]} isLoading />);
    expect(screen.getByLabelText('Loading loan activity')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<LoanTimeline events={[]} error="Service unavailable" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to load loan activity')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<LoanTimeline events={[]} />);
    expect(screen.getByText('No loan activity yet.')).toBeInTheDocument();
  });

  it('orders events newest-first and labels them consistently', () => {
    render(<LoanTimeline events={mockEvents} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Renewed')).toBeInTheDocument();
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
  });

  it('localizes timestamps', () => {
    render(<LoanTimeline events={[mockEvents[0]]} />);
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', '2026-08-01T10:00:00Z');
  });

  it('links each event to its book detail page', () => {
    render(<LoanTimeline events={[mockEvents[0]]} />);
    const link = screen.getByRole('link', {
      name: 'Structure and Interpretation of Computer Programs',
    });
    expect(link).toHaveAttribute('href', '/catalog/book-1');
  });

  it('marks timeline as read-only for immutable history', () => {
    render(<LoanTimeline events={mockEvents} readOnly />);
    expect(screen.getByRole('list', { name: 'Loan activity timeline' })).toHaveAttribute(
      'aria-readonly',
      'true'
    );
  });

  it('shows fine and overdue event types', () => {
    const events: LoanTimelineEvent[] = [
      {
        id: 'evt-overdue',
        type: 'overdue',
        bookTitle: 'Overdue Title',
        bookId: 'book-2',
        timestamp: '2026-08-20T09:00:00Z',
        immutable: true,
      },
      {
        id: 'evt-fine',
        type: 'fine',
        bookTitle: 'Fine Title',
        bookId: 'book-3',
        timestamp: '2026-08-21T09:00:00Z',
        details: '$2.50 assessed',
        immutable: true,
      },
    ];
    render(<LoanTimeline events={events} />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Fine Assessed')).toBeInTheDocument();
  });
});
