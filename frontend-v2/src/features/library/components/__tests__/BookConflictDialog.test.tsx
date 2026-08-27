import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookConflictDialog } from '../BookConflictDialog';
import type { Book } from '../../types/book.types';

const serverBook: Book = {
  id: 'book-1',
  version: 3,
  status: 'published',
  bibliographic: {
    title: 'Server Title',
    description: 'Server description that was saved by another librarian.',
    language: 'en',
  },
  contributors: [{ name: 'Server Author', role: 'author' }],
  taxonomy: { subjects: ['Tech'], audience: 'general' },
  holdings: [{ location: 'Main', callNumber: '001', copies: 1 }],
  digitalFormats: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('BookConflictDialog', () => {
  it('shows conflict alert and never auto-saves', () => {
    render(
      <BookConflictDialog
        isOpen
        serverRecord={serverBook}
        localTitle="My Local Title"
        onReload={vi.fn()}
        onKeepEditing={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i);
    expect(screen.getByText(/Server Title/)).toBeInTheDocument();
  });

  it('allows reload server version', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(
      <BookConflictDialog
        isOpen
        serverRecord={serverBook}
        localTitle="My Local Title"
        onReload={onReload}
        onKeepEditing={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /reload server version/i }));
    expect(onReload).toHaveBeenCalled();
  });

  it('shows compare view with both values', async () => {
    const user = userEvent.setup();
    render(
      <BookConflictDialog
        isOpen
        serverRecord={serverBook}
        localTitle="My Local Title"
        onReload={vi.fn()}
        onKeepEditing={vi.fn()}
        onCompare={vi.fn()}
        comparing
      />
    );
    expect(screen.getByText('My Local Title')).toBeInTheDocument();
    expect(screen.getByText('Server Title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /keep editing mine/i }));
  });
});
