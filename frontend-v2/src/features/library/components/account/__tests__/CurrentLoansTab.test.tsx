import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CurrentLoansTab } from '../CurrentLoansTab';

vi.mock('../../../hooks/usePatronAccount', () => ({
  useCurrentLoans: vi.fn(),
  useRenewLoan: vi.fn(),
}));

import { useCurrentLoans, useRenewLoan } from '../../../hooks/usePatronAccount';
import type { AccountLoan } from '../../../types/account.types';

const loans: AccountLoan[] = [
  {
    id: 'loan-1',
    bookId: 'book-1',
    title: 'The Pragmatic Programmer',
    currentDueDate: '2026-10-01',
    renewalsUsed: 1,
    maxRenewals: 3,
    isOverdue: false,
    canRenew: true,
  },
  {
    id: 'loan-2',
    bookId: 'book-2',
    title: 'Clean Architecture',
    currentDueDate: '2026-09-10',
    renewalsUsed: 3,
    maxRenewals: 3,
    isOverdue: true,
    canRenew: false,
    blockReason: 'max-renewals-reached',
    blockMessage: 'Maximum renewals reached',
  },
];

describe('CurrentLoansTab', () => {
  it('renders renewable and blocked loans from live data', () => {
    vi.mocked(useCurrentLoans).mockReturnValue({
      data: loans,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCurrentLoans>);
    vi.mocked(useRenewLoan).mockReturnValue({
      mutateAsync: vi.fn(),
    } as never);

    render(<CurrentLoansTab patronId="patron-1" />);

    expect(screen.getByText('The Pragmatic Programmer')).toBeInTheDocument();
    expect(screen.getByText('Clean Architecture')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Cannot renew')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
  });

  it('delegates loading to the renewal controls skeleton', () => {
    vi.mocked(useCurrentLoans).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useCurrentLoans>);
    vi.mocked(useRenewLoan).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<CurrentLoansTab patronId="patron-1" />);
    expect(screen.getByLabelText('Loading renewal controls')).toBeInTheDocument();
  });

  it('surfaces the error state', () => {
    vi.mocked(useCurrentLoans).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Loans service unavailable'),
    } as ReturnType<typeof useCurrentLoans>);
    vi.mocked(useRenewLoan).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<CurrentLoansTab patronId="patron-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Loans service unavailable');
  });

  it('shows the empty state when there are no active loans', async () => {
    vi.mocked(useCurrentLoans).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCurrentLoans>);
    vi.mocked(useRenewLoan).mockReturnValue({ mutateAsync: vi.fn() } as never);

    render(<CurrentLoansTab patronId="patron-1" />);
    expect(screen.getByText('No active loans to renew.')).toBeInTheDocument();
  });
});