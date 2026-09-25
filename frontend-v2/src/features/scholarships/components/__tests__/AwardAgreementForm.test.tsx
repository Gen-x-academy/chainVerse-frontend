import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AwardAgreementForm } from '../AwardAgreementForm';
import type { AwardRecord } from '../../types/scholarship.types';

vi.mock('../../hooks/useScholarships', () => ({
  useAcceptAward: vi.fn(),
  useDeclineAward: vi.fn(),
}));

import { useAcceptAward, useDeclineAward } from '../../hooks/useScholarships';

const acceptMutateAsync = vi.fn();
const declineMutateAsync = vi.fn();

function mockIdle() {
  vi.mocked(useAcceptAward).mockReturnValue({
    mutateAsync: acceptMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useAcceptAward>);
  vi.mocked(useDeclineAward).mockReturnValue({
    mutateAsync: declineMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useDeclineAward>);
}

const PENDING_AWARD: AwardRecord = {
  id: 'award-001',
  applicationId: 'app-001',
  studentId: 'student-001',
  amountCents: 50000,
  currency: 'USD',
  status: 'pending',
  grantedAt: '2026-09-01T00:00:00.000Z',
  terms: 'You must maintain a minimum GPA of 3.0.',
  acceptanceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  milestoneIds: [],
};

describe('AwardAgreementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdle();
  });

  it('renders award summary and terms', () => {
    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    expect(screen.getByRole('region', { name: /award agreement/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /review and accept award/i })).toBeInTheDocument();
    expect(screen.getByText(/award summary/i)).toBeInTheDocument();
    expect(screen.getByText(/you must maintain a minimum gpa/i)).toBeInTheDocument();
  });

  it('renders all required declarations as checkboxes', () => {
    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
  });

  it('accept button is disabled until all declarations are checked', () => {
    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const acceptButton = screen.getByRole('button', { name: /accept award/i });
    expect(acceptButton).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.slice(0, 3).forEach((cb) => fireEvent.click(cb));
    expect(acceptButton).toBeDisabled();

    fireEvent.click(checkboxes[3]);
    expect(acceptButton).not.toBeDisabled();
  });

  it('decline button is always enabled for pending awards', () => {
    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const declineButton = screen.getByRole('button', { name: /decline offer/i });
    expect(declineButton).not.toBeDisabled();
  });

  it('shows accepted confirmation with immutable signer details', async () => {
    acceptMutateAsync.mockResolvedValue({
      id: 'agreement-001',
      awardId: 'award-001',
      version: '2026-09-01',
      status: 'accepted',
      signerIdentity: 'user-001',
      signedAt: new Date().toISOString(),
      declarations: [],
    });

    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: /accept award/i }));

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(/award accepted/i);
    expect(confirmation).toHaveTextContent('user-001');
    expect(confirmation).toHaveTextContent('2026-09-01');
  });

  it('shows declined confirmation with disbursement-prevention message', async () => {
    declineMutateAsync.mockResolvedValue({
      id: 'award-001',
      status: 'declined',
    });

    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);
    fireEvent.click(screen.getByRole('button', { name: /decline offer/i }));

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(/offer declined/i);
    expect(confirmation).toHaveTextContent(/no disbursements will be made/i);
  });

  it('shows error alert on accept failure', async () => {
    acceptMutateAsync.mockRejectedValue(new Error('Acceptance window expired'));

    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: /accept award/i }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Acceptance window expired');
  });

  it('shows status badge for already-accepted award (permission state)', () => {
    const acceptedAward: AwardRecord = { ...PENDING_AWARD, status: 'accepted' };
    render(<AwardAgreementForm award={acceptedAward} signerIdentity="user-001" />);

    expect(screen.queryByRole('button', { name: /accept award/i })).not.toBeInTheDocument();
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
  });

  it('shows status badge for declined award', () => {
    const declinedAward: AwardRecord = { ...PENDING_AWARD, status: 'declined' };
    render(<AwardAgreementForm award={declinedAward} signerIdentity="user-001" />);

    expect(screen.queryByRole('button', { name: /decline offer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/declined/i)).toBeInTheDocument();
  });

  it('shows status badge for expired award', () => {
    const expiredAward: AwardRecord = { ...PENDING_AWARD, status: 'expired' };
    render(<AwardAgreementForm award={expiredAward} signerIdentity="user-001" />);

    expect(screen.queryByRole('button', { name: /accept award/i })).not.toBeInTheDocument();
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it('has keyboard-accessible checkboxes', () => {
    render(<AwardAgreementForm award={PENDING_AWARD} signerIdentity="user-001" />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      expect(cb).toHaveAttribute('type', 'checkbox');
    });
  });
});
