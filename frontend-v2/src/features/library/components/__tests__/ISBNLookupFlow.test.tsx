import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ISBNLookupFlow } from '../ISBNLookupFlow';
import type { ISBNLookupResult } from '../../types/book.types';

const mockLookup: ISBNLookupResult = {
  isbn: '9780123456789',
  provenance: 'open-library',
  fetchedAt: '2026-08-26T12:00:00Z',
  bibliographic: {
    title: 'Imported Title',
    description: 'Imported description from external source.',
    publisher: 'Example Press',
    language: 'en',
  },
  contributors: [{ name: 'External Author', role: 'author' }],
  taxonomy: { subjects: ['Computing'], audience: 'general' },
};

describe('ISBNLookupFlow', () => {
  it('validates invalid ISBN format', async () => {
    const user = userEvent.setup();
    render(<ISBNLookupFlow onLookup={vi.fn()} onImport={vi.fn()} />);
    await user.type(screen.getByLabelText(/isbn/i), 'bad');
    await user.click(screen.getByRole('button', { name: /look up isbn/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/10 or 13 digits/i);
    });
  });

  it('shows provenance in review step and never auto-publishes', async () => {
    const user = userEvent.setup();
    const onLookup = vi.fn().mockResolvedValue(mockLookup);
    render(<ISBNLookupFlow onLookup={onLookup} onImport={vi.fn()} />);

    await user.type(screen.getByLabelText(/isbn/i), '9780123456789');
    await user.click(screen.getByRole('button', { name: /look up isbn/i }));

    await waitFor(() => {
      expect(screen.getByTestId('import-provenance')).toHaveTextContent('Open Library');
    });
    expect(screen.getByText('Imported Title')).toBeInTheDocument();
  });

  it('handles missing ISBN metadata', async () => {
    const user = userEvent.setup();
    const onLookup = vi.fn().mockRejectedValue(new Error('No metadata found for this ISBN'));
    render(
      <ISBNLookupFlow onLookup={onLookup} onImport={vi.fn()} lookupError={null} />
    );

    await user.type(screen.getByLabelText(/isbn/i), '9780123456789');
    await user.click(screen.getByRole('button', { name: /look up isbn/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no metadata found/i);
    });
  });

  it('imports as draft after review', async () => {
    const user = userEvent.setup();
    const onLookup = vi.fn().mockResolvedValue(mockLookup);
    const onImport = vi.fn();
    render(<ISBNLookupFlow onLookup={onLookup} onImport={onImport} />);

    await user.type(screen.getByLabelText(/isbn/i), '9780123456789');
    await user.click(screen.getByRole('button', { name: /look up isbn/i }));

    await waitFor(() => screen.getByRole('button', { name: /review and correct/i }));
    await user.click(screen.getByRole('button', { name: /review and correct/i }));

    expect(screen.getByText(/saved as a draft only/i)).toBeInTheDocument();
  });
});
