import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AwardCancellationForm } from '../AwardCancellationForm';
import type { AwardRecord } from '../../types/scholarship.types';

vi.mock('../../hooks/useScholarships', () => ({
  useCancelAward: vi.fn(),
  useTerminateAward: vi.fn(),
}));

import { useCancelAward, useTerminateAward } from '../../hooks/useScholarships';

const cancelMutateAsync = vi.fn();
const terminateMutateAsync = vi.fn();

function mockIdle() {
  vi.mocked(useCancelAward).mockReturnValue({
    mutateAsync: cancelMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCancelAward>);
  vi.mocked(useTerminateAward).mockReturnValue({
    mutateAsync: terminateMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTerminateAward>);
}

const ACTIVE_AWARD: AwardRecord = {
  id: 'award-001',
  applicationId: 'app-001',
  studentId: 'student-001',
  amountCents: 50000,
  currency: 'USD',
  status: 'pending',
  grantedAt: '2026-09-01T00:00:00.000Z',
  terms: 'Standard terms.',
  acceptanceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  milestoneIds: [],
};

describe('AwardCancellationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdle();
  });

  it('renders the form with type toggle', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    expect(screen.getByRole('heading', { name: /cancel or terminate award/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /cancellation \(pre-payment\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /termination \(post-payment\)/i })).toBeInTheDocument();
  });

  it('shows cancellation reasons by default', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    const reasonSelect = screen.getByLabelText(/reason/i);
    expect(reasonSelect).toBeInTheDocument();
    expect(screen.getByText(/applicant request/i)).toBeInTheDocument();
    expect(screen.getByText(/eligibility lost/i)).toBeInTheDocument();
  });

  it('switches to termination reasons when termination is selected', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /termination \(post-payment\)/i }));

    expect(screen.getByText(/academic failure/i)).toBeInTheDocument();
    expect(screen.getByText(/fraud confirmed/i)).toBeInTheDocument();
  });

  it('shows recovery amount field only when partial recovery is selected', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    expect(screen.queryByLabelText(/recovery amount/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /partial recovery/i }));

    expect(screen.getByLabelText(/recovery amount/i)).toBeInTheDocument();
  });

  it('shows confirmation dialog before submitting', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm cancellation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('goes back to form when back button clicked in confirmation', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(screen.getByRole('heading', { name: /cancel or terminate award/i })).toBeInTheDocument();
  });

  it('shows success state after cancellation with notification pending message', async () => {
    cancelMutateAsync.mockResolvedValue({
      id: 'cancel-001',
      awardId: 'award-001',
      type: 'cancellation',
      reason: 'applicant_request',
      authority: 'administrator',
      authorityId: 'admin-001',
      financialConsequence: 'none',
      effectiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    const successStatus = await screen.findByRole('status');
    expect(successStatus).toHaveTextContent(/award cancellation recorded/i);
    expect(successStatus).toHaveTextContent(/notification/i);
  });

  it('shows success state after termination', async () => {
    terminateMutateAsync.mockResolvedValue({
      id: 'terminate-001',
      awardId: 'award-001',
      type: 'termination',
      reason: 'academic_failure',
      authority: 'finance',
      authorityId: 'finance-001',
      financialConsequence: 'partial_recovery',
      recoveryAmountCents: 25000,
      effectiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="finance"
        authorityId="finance-001"
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /termination \(post-payment\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm termination/i }));

    const successStatus = await screen.findByRole('status');
    expect(successStatus).toHaveTextContent(/award termination recorded/i);
    expect(successStatus).toHaveTextContent(/future payments.*stopped/i);
  });

  it('shows error alert on API failure', async () => {
    cancelMutateAsync.mockRejectedValue(new Error('Award already cancelled'));

    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Award already cancelled');
  });

  it('has accessible radio groups for type and financial consequence', () => {
    render(
      <AwardCancellationForm
        award={ACTIVE_AWARD}
        authority="administrator"
        authorityId="admin-001"
      />
    );

    expect(screen.getByRole('radiogroup', { name: /action type/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /financial consequence/i })).toBeInTheDocument();
  });
});
