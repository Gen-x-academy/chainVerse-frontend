import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookDetailView } from '../BookDetailView';
import { BookServiceError } from '../../services/book.service';
import type { Book } from '../../types/book.types';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));
vi.mock('../../hooks/useBooks', () => ({
  useBook: vi.fn(),
}));
vi.mock('../../hooks/useLibrarianPermissions', () => ({
  useLibrarianPermissions: vi.fn(),
}));
vi.mock('@/src/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'patron-1' } }),
}));

import { notFound } from 'next/navigation';
import { useBook } from '../../hooks/useBooks';
import { useLibrarianPermissions } from '../../hooks/useLibrarianPermissions';

const book: Book = {
  id: 'book-1',
  version: 1,
  status: 'published',
  bibliographic: {
    title: 'Clean Code',
    description: 'A handbook of agile software craftsmanship.',
    isbn: '9780132350884',
    language: 'English',
    publicationYear: 2008,
  },
  contributors: [{ name: 'Robert Martin', role: 'author' }],
  taxonomy: { subjects: ['Software Engineering'], audience: 'Adult' },
  holdings: [{ location: 'Main Stacks', callNumber: 'QA76.73', copies: 2 }],
  digitalFormats: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('BookDetailView', () => {
  it('renders the fetched book details', () => {
    vi.mocked(useBook).mockReturnValue({
      data: book,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useBook>);
    vi.mocked(useLibrarianPermissions).mockReturnValue(['catalog'] as never);
    render(<BookDetailView bookId="book-1" />);

    expect(screen.getByRole('heading', { name: 'Clean Code' })).toBeInTheDocument();
    expect(screen.getByText('Robert Martin')).toBeInTheDocument();
    expect(screen.getByText(/ISBN 9780132350884/)).toBeInTheDocument();
    expect(screen.getByText('QA76.73 · 2 copies')).toBeInTheDocument();
  });

  it('calls router notFound when the book id is invalid (404)', () => {
    vi.mocked(useBook).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new BookServiceError('Book not found', 404, 'not_found'),
    } as ReturnType<typeof useBook>);
    vi.mocked(useLibrarianPermissions).mockReturnValue([] as never);
    render(<BookDetailView bookId="does-not-exist" />);

    expect(notFound).toHaveBeenCalled();
  });

  it('renders a recoverable error for non-404 failures', () => {
    vi.mocked(useBook).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Backend unreachable'),
    } as ReturnType<typeof useBook>);
    vi.mocked(useLibrarianPermissions).mockReturnValue([] as never);
    render(<BookDetailView bookId="book-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });
});