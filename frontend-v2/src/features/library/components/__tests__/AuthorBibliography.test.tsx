import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthorBibliography } from '../AuthorBibliography';

vi.mock('../../hooks/useAuthor', () => ({
  useAuthorBooks: vi.fn(),
}));

import { useAuthorBooks } from '../../hooks/useAuthor';

describe('AuthorBibliography', () => {
  it('renders loading skeleton', () => {
    vi.mocked(useAuthorBooks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useAuthorBooks>);
    render(<AuthorBibliography authorId="author-1" />);
    expect(screen.getByLabelText('Loading bibliography')).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useAuthorBooks).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      isFetching: false,
    } as ReturnType<typeof useAuthorBooks>);
    render(<AuthorBibliography authorId="author-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load bibliography');
  });

  it('renders empty bibliography', () => {
    vi.mocked(useAuthorBooks).mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 12 },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useAuthorBooks>);
    render(<AuthorBibliography authorId="author-1" />);
    expect(screen.getByText('No books found for this author.')).toBeInTheDocument();
  });

  it('renders paginated books with accessible links', () => {
    vi.mocked(useAuthorBooks).mockReturnValue({
      data: {
        data: [{ id: 'book-1', title: 'Test Book', year: 2024, format: 'Print' }],
        total: 1,
        page: 1,
        limit: 12,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useAuthorBooks>);
    render(<AuthorBibliography authorId="author-1" />);
    const link = screen.getByRole('link', { name: /View Test Book/i });
    expect(link).toHaveAttribute('href', '/catalog/book-1');
  });
});
