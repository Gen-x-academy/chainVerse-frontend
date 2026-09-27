import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipConcurrencyPanel } from '../ScholarshipConcurrencyPanel';
import type { VersionedDocument } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const DOCUMENT: VersionedDocument = {
  resource: {
    resourceType: 'program',
    resourceId: 'chainverse-scholarship',
    version: 4,
    updatedAt: '2025-02-20T00:00:00.000Z',
    updatedBy: 'finance-one',
  },
  fields: {
    title: 'ChainVerse Scholarship',
    awardCeilingCents: 4800000,
    currency: 'USD',
    notes: '',
  },
};

const mockGet = vi.mocked(apiClient.get);

describe('ScholarshipConcurrencyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading first', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ScholarshipConcurrencyPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading the current version/i);
  });

  it('renders an error state that explains nothing can be written', async () => {
    mockGet.mockRejectedValue(new Error('version endpoint 503'));
    render(<ScholarshipConcurrencyPanel />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).toHaveTextContent(/version endpoint 503/);
    expect(screen.getByRole('button', { name: /retry loading the resource/i })).toBeEnabled();
  });

  it('renders an empty state when no versioned resource exists', async () => {
    mockGet.mockResolvedValue(null);
    render(<ScholarshipConcurrencyPanel />);

    expect(await screen.findByText(/no versioned resource was found/i)).toBeInTheDocument();
  });

  it('labels the editable fields and shows the server version', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    render(<ScholarshipConcurrencyPanel />);

    await screen.findByLabelText(/program title/i);
    expect(screen.getByLabelText(/program title/i)).toHaveValue('ChainVerse Scholarship');
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByText('Server version 4')).toBeInTheDocument();
    expect(screen.getAllByText(/48,000\.00/).length).toBeGreaterThan(0);
  });

  it('reports a permission-denied state and disables submitting', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    render(<ScholarshipConcurrencyPanel canManage={false} />);

    expect(await screen.findByRole('note')).toHaveTextContent(/do not have permission to write/i);
    expect(screen.getByRole('button', { name: /submit with the held version/i })).toBeDisabled();
    expect(screen.getByLabelText(/program title/i)).toBeDisabled();
  });

  it('rejects a stale write and shows the field-by-field comparison', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    const user = userEvent.setup();
    render(<ScholarshipConcurrencyPanel />);

    const title = await screen.findByLabelText(/program title/i);
    await user.clear(title);
    await user.type(title, 'My title');
    await user.click(screen.getByRole('button', { name: /simulate a concurrent server edit/i }));
    await user.click(screen.getByRole('button', { name: /submit with the held version/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/version conflict/i);
    expect(alert).toHaveTextContent(/expected version 4/i);
    expect(alert).toHaveTextContent(/server is at 5/i);

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('My title');
    expect(table).toHaveTextContent('renamed by another editor');
    expect(screen.getByRole('button', { name: /reload server value/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /keep mine \(rebase\)/i })).toBeEnabled();
  });

  it('reloads the server value and discards the local edit', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    const user = userEvent.setup();
    render(<ScholarshipConcurrencyPanel />);

    const title = await screen.findByLabelText(/program title/i);
    await user.clear(title);
    await user.type(title, 'My title');
    await user.click(screen.getByRole('button', { name: /simulate a concurrent server edit/i }));
    await user.click(screen.getByRole('button', { name: /submit with the held version/i }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /reload server value/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/program title/i)).toHaveValue(
        'ChainVerse Scholarship (renamed by another editor)'
      )
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/reloaded the server value at version 5/i)).toBeInTheDocument();
  });

  it('rebases the local edit onto the server version and saves cleanly', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    const user = userEvent.setup();
    render(<ScholarshipConcurrencyPanel />);

    const title = await screen.findByLabelText(/program title/i);
    await user.clear(title);
    await user.type(title, 'My title');
    await user.click(screen.getByRole('button', { name: /simulate a concurrent server edit/i }));
    await user.click(screen.getByRole('button', { name: /submit with the held version/i }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /keep mine \(rebase\)/i }));
    await waitFor(() =>
      expect(screen.getByText(/rebased onto version 5 and saved as version 6/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/program title/i)).toHaveValue('My title');
  });

  it('applies a write cleanly when the held version is still current', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    const user = userEvent.setup();
    render(<ScholarshipConcurrencyPanel />);

    const title = await screen.findByLabelText(/program title/i);
    await user.clear(title);
    await user.type(title, 'Fresh title');
    await user.click(screen.getByRole('button', { name: /submit with the held version/i }));

    expect(await screen.findByText(/saved cleanly as version 5/i)).toBeInTheDocument();
  });

  it('blocks an empty required field with a described error', async () => {
    mockGet.mockResolvedValue(DOCUMENT);
    const user = userEvent.setup();
    render(<ScholarshipConcurrencyPanel />);

    const title = await screen.findByLabelText(/program title/i);
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: /submit with the held version/i }));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(/title is required/i);
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', message.id);
  });
});
