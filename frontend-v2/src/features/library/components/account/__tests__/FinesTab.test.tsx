import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinesTab } from '../FinesTab';

vi.mock('../../../hooks/usePatronAccount', () => ({
  useOutstandingFines: vi.fn(),
  useFinesLedger: vi.fn(),
  usePayFines: vi.fn(),
}));

import { useFinesLedger, useOutstandingFines, usePayFines } from '../../../hooks/usePatronAccount';

describe('FinesTab', () => {
  it('shows payment card when there are outstanding fines', () => {
    vi.mocked(useOutstandingFines).mockReturnValue({
      data: [
        { id: 'fine-1', amountCents: 750, currency: 'USD', accruedAt: '2026-09-01' },
        { id: 'fine-2', amountCents: 250, currency: 'USD', accruedAt: '2026-09-02' },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOutstandingFines>);
    vi.mocked(useFinesLedger).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useFinesLedger>);
    vi.mocked(usePayFines).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<FinesTab patronId="patron-1" />);
    expect(screen.getByRole('button', { name: 'Pay with Wallet' })).toBeInTheDocument();
  });

  it('shows a clean state with no outstanding fines', () => {
    vi.mocked(useOutstandingFines).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOutstandingFines>);
    vi.mocked(useFinesLedger).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useFinesLedger>);
    vi.mocked(usePayFines).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<FinesTab patronId="patron-1" />);
    expect(screen.getByText(/no outstanding fines/i)).toBeInTheDocument();
  });

  it('shows an error when outstanding fines cannot load', () => {
    vi.mocked(useOutstandingFines).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Fines service unavailable'),
    } as ReturnType<typeof useOutstandingFines>);
    vi.mocked(useFinesLedger).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useFinesLedger>);
    vi.mocked(usePayFines).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<FinesTab patronId="patron-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fines service unavailable');
  });

  it('renders ledger entries from the fines ledger query', () => {
    vi.mocked(useOutstandingFines).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOutstandingFines>);
    vi.mocked(useFinesLedger).mockReturnValue({
      data: [
        {
          id: 'ledger-1',
          kind: 'fine',
          amountCents: 500,
          currency: 'USD',
          createdAt: '2026-08-01',
          reference: 'F-1001',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useFinesLedger>);
    vi.mocked(usePayFines).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<FinesTab patronId="patron-1" />);
    expect(screen.getByText('F-1001')).toBeInTheDocument();
    expect(screen.getByText('Charge & Payment Ledger')).toBeInTheDocument();
  });
});