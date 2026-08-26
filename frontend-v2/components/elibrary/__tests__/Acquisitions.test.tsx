import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PurchaseIntakeForm } from '../PurchaseIntakeForm';
import { AccessionForm } from '../AccessionForm';
import { AcquisitionQueue } from '../AcquisitionQueue';
import { LibraryAdminLayout } from '../LibraryAdminLayout';
import type { AcquisitionQueueItem } from '@/src/features/library/types/acquisitions.types';

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { role: string } }) => unknown) =>
    selector({ user: { role: 'admin' } }),
  ),
}));

const mockQueueItem: AcquisitionQueueItem = {
  id: 'intake-1',
  title: 'Web3 Guide',
  author: 'Bob Jones',
  source: 'vendor',
  receivedDate: '2026-08-01',
  status: 'pending',
  copyCount: 0,
};

describe('PurchaseIntakeForm', () => {
  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<PurchaseIntakeForm canViewCost onSubmit={vi.fn()} />);
    await user.click(screen.getByText('Submit intake'));
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('shows cost fields when canViewCost is true', () => {
    render(<PurchaseIntakeForm canViewCost onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Cost amount')).toBeInTheDocument();
  });

  it('hides cost fields when canViewCost is false', () => {
    render(<PurchaseIntakeForm canViewCost={false} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('Cost amount')).not.toBeInTheDocument();
    expect(screen.getByText(/restricted to administrators/i)).toBeInTheDocument();
  });

  it('requires vendor name for vendor source', async () => {
    const user = userEvent.setup();
    render(<PurchaseIntakeForm canViewCost onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText('Title *'), 'Test Book');
    await user.type(screen.getByLabelText('Author *'), 'Author Name');
    await user.click(screen.getByText('Submit intake'));
    await waitFor(() => {
      expect(screen.getByText(/vendor name is required/i)).toBeInTheDocument();
    });
  });
});

describe('AccessionForm', () => {
  it('requires location for copies', async () => {
    const user = userEvent.setup();
    render(
      <AccessionForm intakeTitle="Test Book" onSubmit={vi.fn()} />,
    );
    await user.click(screen.getByText('Complete accession'));
    await waitFor(() => {
      expect(screen.getByText('Location is required')).toBeInTheDocument();
    });
  });

  it('shows book record link when provided', () => {
    render(
      <AccessionForm
        intakeTitle="Test Book"
        bookRecordId="book-123"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('book-123')).toBeInTheDocument();
  });
});

describe('AcquisitionQueue', () => {
  it('renders queue items with accession link', () => {
    render(<AcquisitionQueue items={[mockQueueItem]} />);
    expect(screen.getByText('Web3 Guide')).toBeInTheDocument();
    expect(screen.getByText('Accession')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<AcquisitionQueue items={[]} />);
    expect(screen.getByText(/no acquisitions in queue/i)).toBeInTheDocument();
  });
});

describe('LibraryAdminLayout permission guard', () => {
  it('renders admin nav for admin role', () => {
    render(
      <LibraryAdminLayout requiredPermission="catalog">
        <p>Protected content</p>
      </LibraryAdminLayout>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });
});
