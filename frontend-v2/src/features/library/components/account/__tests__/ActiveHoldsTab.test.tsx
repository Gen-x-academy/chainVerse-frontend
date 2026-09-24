import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveHoldsTab } from '../ActiveHoldsTab';

vi.mock('../../../hooks/usePatronAccount', () => ({
  useAccountHolds: vi.fn(),
}));

import { useAccountHolds } from '../../../hooks/usePatronAccount';

describe('ActiveHoldsTab', () => {
  it('renders holds with queue position and status', () => {
    vi.mocked(useAccountHolds).mockReturnValue({
      data: [
        { bookId: 'book-1', bookTitle: 'Clean Code', position: 2, totalHolders: 5, status: 'waiting' },
        { bookId: 'book-2', bookTitle: 'Refactoring', position: 1, totalHolders: 1, status: 'ready' },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAccountHolds>);

    render(<ActiveHoldsTab patronId="patron-1" />);
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('Position 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Ready for Pickup')).toBeInTheDocument();
  });

  it('shows an empty state when there are no holds', () => {
    vi.mocked(useAccountHolds).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAccountHolds>);

    render(<ActiveHoldsTab patronId="patron-1" />);
    expect(screen.getByText('No active holds.')).toBeInTheDocument();
  });

  it('shows an error state on failure', () => {
    vi.mocked(useAccountHolds).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Holds service unavailable'),
    } as ReturnType<typeof useAccountHolds>);

    render(<ActiveHoldsTab patronId="patron-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Holds service unavailable');
  });
});