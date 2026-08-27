import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthorCard } from '../AuthorCard';

const mockAuthor = {
  id: 'author-1',
  name: 'Ada Lovelace',
  bookCount: 12,
  nationality: 'British',
};

describe('AuthorCard', () => {
  it('renders author name and book count', () => {
    render(<AuthorCard author={mockAuthor} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/12 books/)).toBeInTheDocument();
  });

  it('links to the author profile page', () => {
    render(<AuthorCard author={mockAuthor} />);
    const link = screen.getByRole('link', { name: /View profile for Ada Lovelace/i });
    expect(link).toHaveAttribute('href', '/authors/author-1');
  });

  it('shows initial avatar when no image', () => {
    render(<AuthorCard author={mockAuthor} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows nationality when provided', () => {
    render(<AuthorCard author={mockAuthor} />);
    expect(screen.getByText(/British/)).toBeInTheDocument();
  });
});
