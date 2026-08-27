import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoanActivityPanel } from '../LoanActivityPanel';

vi.mock('../../hooks/useLoanActivity', () => ({
  useLoanActivity: vi.fn(),
}));

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'patron-1' } }),
}));

import { useLoanActivity } from '../../hooks/useLoanActivity';

describe('LoanActivityPanel', () => {
  it('shows immutable history notice', () => {
    vi.mocked(useLoanActivity).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useLoanActivity>);
    render(<LoanActivityPanel />);
    expect(screen.getByText('History cannot be edited')).toBeInTheDocument();
  });

  it('delegates loading state to LoanTimeline', () => {
    vi.mocked(useLoanActivity).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useLoanActivity>);
    render(<LoanActivityPanel />);
    expect(screen.getByLabelText('Loading loan activity')).toBeInTheDocument();
  });

  it('passes patron id for librarian views', () => {
    vi.mocked(useLoanActivity).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useLoanActivity>);
    render(<LoanActivityPanel patronId="patron-99" />);
    expect(useLoanActivity).toHaveBeenCalledWith('patron-99');
  });
});
