import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'staff-1' } }),
}));

vi.mock('@/src/features/library/services/library.service', () => ({
  libraryService: {
    getPatronProfile: vi.fn(),
    getPatronPolicy: vi.fn(),
    getPatronEligibility: vi.fn(),
    lookupByBarcode: vi.fn(),
    checkoutPhysical: vi.fn(),
  },
}));

import { PhysicalCheckoutFlow } from '../PhysicalCheckoutFlow';
import { libraryService } from '@/src/features/library/services/library.service';

const patron = { id: 'p-1', name: 'Ada Lovelace', role: 'student', status: 'active' as const };
const policy = {
  patronId: 'p-1',
  role: 'student',
  status: 'active' as const,
  maxActiveLoans: 5,
  maxRenewals: 2,
  loanPeriodDays: 14,
  maxActiveHolds: 3,
  policyApplied: 'default' as const,
};
const copy = {
  copyId: 'c-1',
  barcode: '9780000000001',
  title: 'Dune',
  author: 'Frank Herbert',
  status: 'available' as const,
  locationLabel: 'Main / A1',
};

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function findPatron(user: ReturnType<typeof setupUser>, id = 'p-1') {
  await user.type(screen.getByLabelText('Patron ID or email'), id);
  await user.click(screen.getByRole('button', { name: /find patron/i }));
}

async function scanCopy(user: ReturnType<typeof setupUser>, barcode = '9780000000001') {
  await user.type(screen.getByLabelText('Scan barcode'), barcode);
  await user.keyboard('{Enter}');
}

describe('PhysicalCheckoutFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(libraryService.getPatronProfile).mockReset().mockResolvedValue(patron);
    vi.mocked(libraryService.getPatronPolicy).mockReset().mockResolvedValue(policy);
    vi.mocked(libraryService.getPatronEligibility).mockReset().mockResolvedValue({ eligible: true });
    vi.mocked(libraryService.lookupByBarcode).mockReset().mockResolvedValue(copy);
    vi.mocked(libraryService.checkoutPhysical).mockReset().mockResolvedValue({
      id: 'loan-1',
      patronId: 'p-1',
      bookId: 'b-1',
      checkedOutAt: '2026-09-24T10:00:00.000Z',
      dueDate: '2026-10-08',
      status: 'active',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks out a copy once the patron and copy are identified', async () => {
    const user = setupUser();
    render(<PhysicalCheckoutFlow />);

    await findPatron(user);
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

    await scanCopy(user);
    await waitFor(() => expect(screen.getAllByText('Dune').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /confirm checkout/i }));

    await waitFor(() =>
      expect(libraryService.checkoutPhysical).toHaveBeenCalledWith({
        barcode: '9780000000001',
        patronId: 'p-1',
        staffId: 'staff-1',
      })
    );
    expect(await screen.findByLabelText('Checkout receipt')).toBeInTheDocument();
    expect(screen.getByText('2026-10-08')).toBeInTheDocument();
  });

  it('prevents repeat submission after a successful checkout', async () => {
    const user = setupUser();
    render(<PhysicalCheckoutFlow />);

    await findPatron(user);
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
    await scanCopy(user);
    await waitFor(() => expect(screen.getAllByText('Dune').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /confirm checkout/i }));
    await screen.findByLabelText('Checkout receipt');

    expect(screen.queryByRole('button', { name: /confirm checkout/i })).not.toBeInTheDocument();
    expect(libraryService.checkoutPhysical).toHaveBeenCalledTimes(1);
  });

  it('preserves the patron and copy selections when checkout fails', async () => {
    vi.mocked(libraryService.checkoutPhysical).mockRejectedValue(
      new Error('Copy was claimed by another request before checkout could complete')
    );
    const user = setupUser();
    render(<PhysicalCheckoutFlow />);

    await findPatron(user);
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
    await scanCopy(user);
    await waitFor(() => expect(screen.getAllByText('Dune').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /confirm checkout/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/claimed by another request/i)
    );
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dune').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /confirm checkout/i })).toBeInTheDocument();
  });

  it('warns about policy violations and disables confirmation', async () => {
    vi.mocked(libraryService.getPatronEligibility).mockResolvedValue({
      eligible: false,
      reasons: ['Active loan limit reached (5/5).'],
    });
    const user = setupUser();
    render(<PhysicalCheckoutFlow />);

    await findPatron(user);
    await scanCopy(user);

    await waitFor(() =>
      expect(screen.getByText(/active loan limit reached/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /confirm checkout/i })).toBeDisabled();
  });

  it('shows empty guidance and a due-date preview', async () => {
    const user = setupUser();
    render(<PhysicalCheckoutFlow />);

    expect(screen.getByText(/no patron selected/i)).toBeInTheDocument();
    expect(screen.getByText(/no copy selected yet/i)).toBeInTheDocument();

    await findPatron(user);
    await waitFor(() =>
      expect(screen.getAllByText(/due date preview/i).length).toBeGreaterThan(0)
    );
  });
});
