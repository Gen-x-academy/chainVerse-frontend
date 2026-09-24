import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authState = vi.hoisted(() => ({ role: 'admin' as string }));

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) =>
    selector({ user: { role: authState.role } }),
}));

vi.mock('@/src/features/library/services/acquisitions.service', () => ({
  acquisitionsService: { listQueue: vi.fn() },
}));

vi.mock('@/src/features/library/services/library.service', () => ({
  libraryService: {
    getLocationTree: vi.fn(),
    searchCatalogMatches: vi.fn(),
    validateLocation: vi.fn(),
    submitDonationIntake: vi.fn(),
  },
}));

import AcquisitionsPage from '../page';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import { libraryService } from '@/src/features/library/services/library.service';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';

const queueItem: AcquisitionQueueItem = {
  id: 'intake-1',
  title: 'Web3 Guide',
  author: 'Bob Jones',
  source: 'vendor',
  receivedDate: '2026-08-01',
  status: 'pending',
  copyCount: 0,
};

describe('AcquisitionsPage route', () => {
  beforeEach(() => {
    authState.role = 'admin';
    vi.mocked(acquisitionsService.listQueue).mockReset().mockResolvedValue([]);
    vi.mocked(libraryService.getLocationTree).mockReset().mockResolvedValue([]);
  });

  it('keeps both the purchase and donation entry points reachable', async () => {
    render(<AcquisitionsPage />);

    expect(screen.getByRole('link', { name: /new purchase intake/i })).toHaveAttribute(
      'href',
      '/library/acquisitions/new'
    );
    expect(screen.getByRole('link', { name: /import by isbn/i })).toHaveAttribute(
      'href',
      '/library/acquisitions/import'
    );
    expect(screen.getByRole('heading', { name: /donation intake/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Intake progress')).toBeInTheDocument();
  });

  it('renders the accession queue from the API', async () => {
    vi.mocked(acquisitionsService.listQueue).mockResolvedValue([queueItem]);

    render(<AcquisitionsPage />);

    await waitFor(() => expect(screen.getByText('Web3 Guide')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Accession' })).toHaveAttribute(
      'href',
      '/library/acquisitions/intake-1/accession'
    );
  });

  it('shows a queue failure state', async () => {
    vi.mocked(acquisitionsService.listQueue).mockRejectedValue(new Error('Queue unavailable'));

    render(<AcquisitionsPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Queue unavailable'));
  });

  it('blocks staff without acquisitions permission', async () => {
    authState.role = 'student';

    render(<AcquisitionsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/access denied|insufficient permissions/i);
    expect(screen.queryByRole('link', { name: /new purchase intake/i })).not.toBeInTheDocument();
  });

  it('exposes accessible section landmarks', async () => {
    render(<AcquisitionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Acquisitions' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /donation intake/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /acquisition queue/i })
    ).toBeInTheDocument();
  });
});
