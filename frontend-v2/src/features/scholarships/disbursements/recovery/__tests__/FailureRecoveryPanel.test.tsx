import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FailureRecoveryPanel } from '../components/FailureRecoveryPanel';
import type { DiagnosticReport, PayoutFailure, RetryResult } from '../types';

vi.mock('../service', () => ({
  recoveryService: {
    listFailures: vi.fn(),
    getDiagnostics: vi.fn(),
    retry: vi.fn(),
    acknowledgeFailure: vi.fn(),
  },
}));

import { recoveryService } from '../service';

const mockFailure: PayoutFailure = {
  id: 'fail-001',
  disbursementIntentId: 'intent-001',
  awardId: 'aw-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  failureReason: 'missing_trustline',
  failureDetail: 'Recipient has no trustline for XLM',
  recoveryStatus: 'open',
  retryCount: 0,
  maxRetries: 3,
  failedAt: '2026-09-25T11:00:00.000Z',
};

const mockDiagnostics: DiagnosticReport = {
  failureId: 'fail-001',
  failureReason: 'missing_trustline',
  operatorNotes: 'Recipient must add trustline.',
  suggestedAction: 'Contact recipient.',
  affectedAccounts: ['GABC123XYZ'],
  canRetry: true,
  retryRequiresNewEnvelope: true,
  awardEligibilityPreserved: true,
  generatedAt: '2026-09-25T11:05:00.000Z',
};

const mockRetryResult: RetryResult = {
  newDisbursementIntentId: 'intent-retry-001',
  originalFailureId: 'fail-001',
  enqueued: true,
  message: 'Retry enqueued.',
};

describe('FailureRecoveryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(recoveryService.listFailures).mockImplementation(() => new Promise(() => {}));

    render(<FailureRecoveryPanel />);

    expect(screen.getByRole('status', { name: /loading failures/i })).toBeInTheDocument();
  });

  it('renders empty success state when no failures', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([]);

    render(<FailureRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/no payout failures to recover/i)).toBeInTheDocument();
    });
  });

  it('renders failure items with reason badge', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);

    render(<FailureRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/missing trustline/i)).toBeInTheDocument();
    });
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
  });

  it('shows trustline guidance alert for missing_trustline failures', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);

    render(<FailureRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert', { name: /missing trustline guidance/i })).toBeInTheDocument();
    });
  });

  it('shows retry button for retryable open failures', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);

    render(<FailureRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('hides retry button when max retries reached', async () => {
    const exhausted: PayoutFailure = { ...mockFailure, retryCount: 3, maxRetries: 3 };
    vi.mocked(recoveryService.listFailures).mockResolvedValue([exhausted]);

    render(<FailureRecoveryPanel />);

    await waitFor(() => screen.getByText(/missing trustline/i));
    expect(screen.queryByRole('button', { name: /^retry$/i })).not.toBeInTheDocument();
  });

  it('retries with a new envelope key and shows success', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);
    vi.mocked(recoveryService.retry).mockResolvedValue(mockRetryResult);

    render(<FailureRecoveryPanel />);

    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/retry enqueued/i);
    });

    expect(recoveryService.retry).toHaveBeenCalledWith(
      expect.objectContaining({ failureId: 'fail-001' })
    );
  });

  it('shows error when retry fails', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);
    vi.mocked(recoveryService.retry).mockRejectedValue(new Error('Max retries exceeded'));

    render(<FailureRecoveryPanel />);

    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Max retries exceeded');
    });
  });

  it('expands diagnostics when clicking Diagnostics button', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([mockFailure]);
    vi.mocked(recoveryService.getDiagnostics).mockResolvedValue(mockDiagnostics);

    render(<FailureRecoveryPanel />);

    await waitFor(() => screen.getByRole('button', { name: /diagnostics/i }));
    await userEvent.click(screen.getByRole('button', { name: /diagnostics/i }));

    await waitFor(() => {
      expect(screen.getByText(/operator diagnostics/i)).toBeInTheDocument();
    });
  });

  it('shows error state when listFailures fails', async () => {
    vi.mocked(recoveryService.listFailures).mockRejectedValue(new Error('Server error'));

    render(<FailureRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('filters by programId when provided', async () => {
    vi.mocked(recoveryService.listFailures).mockResolvedValue([]);

    render(<FailureRecoveryPanel programId="prog-001" />);

    await waitFor(() => {
      expect(recoveryService.listFailures).toHaveBeenCalledWith(
        expect.objectContaining({ programId: 'prog-001' })
      );
    });
  });
});
