import { beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountOverviewPanel } from '../AccountOverviewPanel';

vi.mock('../../../hooks/usePatronAccount', () => ({
  useAccountSummary: vi.fn(),
}));

import { useAccountSummary } from '../../../hooks/usePatronAccount';

describe('AccountOverviewPanel', () => {
  beforeEach(() => {
    vi.mocked(useAccountSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAccountSummary>);
  });

  it('prompts sign-in when there is no patron id', () => {
    render(<AccountOverviewPanel />);
    expect(screen.getByText('Sign in required')).toBeInTheDocument();
  });

  it('shows a loading skeleton while the summary loads', () => {
    vi.mocked(useAccountSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useAccountSummary>);
    const { container } = render(<AccountOverviewPanel patronId="patron-1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('surfaces the error state when the summary request fails', () => {
    vi.mocked(useAccountSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Library API unavailable'),
    } as ReturnType<typeof useAccountSummary>);
    render(<AccountOverviewPanel patronId="patron-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Library API unavailable');
  });

  it('renders authoritative summary metrics with backend currency values', () => {
    vi.mocked(useAccountSummary).mockReturnValue({
      data: {
        activeLoans: 3,
        pendingHolds: 1,
        totalCheckouts: 14,
        outstandingFinesCents: 1250,
        currency: 'USD',
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAccountSummary>);
    render(<AccountOverviewPanel patronId="patron-1" />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });
});