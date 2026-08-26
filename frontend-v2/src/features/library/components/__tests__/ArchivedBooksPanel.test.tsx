import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchivedBooksPanel } from '../ArchivedBooksPanel';

const mockArchivedBook = {
  id: 'book-arch-1',
  title: 'Withdrawn Manual',
  authorName: 'Unknown Author',
  archivedAt: '2026-07-01T12:00:00Z',
  archiveReason: 'Superseded edition available',
  status: 'archived' as const,
};

vi.mock('../../hooks/useArchivedBooks', () => ({
  useArchivedBooks: vi.fn(),
  useRestoreBook: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

import { useArchivedBooks } from '../../hooks/useArchivedBooks';

describe('ArchivedBooksPanel', () => {
  beforeEach(() => {
    vi.mocked(useArchivedBooks).mockReturnValue({
      data: { data: [mockArchivedBook], total: 1, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useArchivedBooks>);
  });

  it('blocks patron access to archived management', () => {
    render(<ArchivedBooksPanel isLibrarian={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
  });

  it('renders loading state for librarians', () => {
    vi.mocked(useArchivedBooks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useArchivedBooks>);
    render(<ArchivedBooksPanel isLibrarian />);
    expect(screen.getByLabelText('Loading archived books')).toBeInTheDocument();
  });

  it('renders error state for librarians', () => {
    vi.mocked(useArchivedBooks).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Forbidden'),
      isFetching: false,
    } as ReturnType<typeof useArchivedBooks>);
    render(<ArchivedBooksPanel isLibrarian />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load archived books');
  });

  it('shows archived status badge and restore action for librarians', () => {
    render(<ArchivedBooksPanel isLibrarian />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Withdrawn Manual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore Withdrawn Manual/i })).toBeInTheDocument();
  });

  it('opens restore confirmation dialog explaining the effect', async () => {
    const user = userEvent.setup();
    render(<ArchivedBooksPanel isLibrarian />);
    await user.click(screen.getByRole('button', { name: /Restore Withdrawn Manual/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/return the book to active catalog discovery/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore to catalog' })).toBeInTheDocument();
  });

  it('renders empty state when no archived books', () => {
    vi.mocked(useArchivedBooks).mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useArchivedBooks>);
    render(<ArchivedBooksPanel isLibrarian />);
    expect(screen.getByText(/No archived books/i)).toBeInTheDocument();
  });
});
