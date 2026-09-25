import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TransactionTracker } from '../components/TransactionTracker';
import type { LedgerTransaction } from '../types';

vi.mock('../service', () => ({
  transactionService: {
    list: vi.fn(),
  },
}));

import { transactionService } from '../service';

const baseTx: LedgerTransaction = {
  id: 'tx-001',
  disbursementIntentId: 'intent-001',
  awardId: 'aw-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  status: 'successful',
  txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  ledgerSequence: 54321,
  submittedAt: '2026-09-25T12:00:00.000Z',
  confirmedAt: '2026-09-25T12:01:00.000Z',
  finalizedAt: '2026-09-25T12:01:30.000Z',
  requiredConfirmations: 1,
  currentConfirmations: 1,
  network: 'testnet',
};

describe('TransactionTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(transactionService.list).mockImplementation(() => new Promise(() => {}));

    render(<TransactionTracker />);

    expect(screen.getByRole('status', { name: /loading transactions/i })).toBeInTheDocument();
  });

  it('renders empty state when no transactions', async () => {
    vi.mocked(transactionService.list).mockResolvedValue([]);

    render(<TransactionTracker />);

    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });

  it('renders transaction table with status badge', async () => {
    vi.mocked(transactionService.list).mockResolvedValue([baseTx]);

    render(<TransactionTracker />);

    await waitFor(() => {
      expect(screen.getByText('Successful')).toBeInTheDocument();
    });
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
  });

  it('renders all transaction status variants', async () => {
    const statuses: LedgerTransaction['status'][] = [
      'submitted', 'pending', 'successful', 'failed', 'expired', 'reversed',
    ];
    const txs = statuses.map((status, i) => ({ ...baseTx, id: `tx-00${i}`, status }));
    vi.mocked(transactionService.list).mockResolvedValue(txs);

    render(<TransactionTracker />);

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Successful')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('Reversed')).toBeInTheDocument();
    });
  });

  it('opens detail panel when clicking Details', async () => {
    vi.mocked(transactionService.list).mockResolvedValue([baseTx]);

    render(<TransactionTracker />);

    await waitFor(() => screen.getByRole('button', { name: /view details for transaction tx-001/i }));
    await userEvent.click(screen.getByRole('button', { name: /view details for transaction tx-001/i }));

    expect(screen.getByRole('region', { name: /transaction details/i })).toBeInTheDocument();
    expect(screen.getByText(/ledger sequence/i)).toBeInTheDocument();
  });

  it('closes detail panel on close button', async () => {
    vi.mocked(transactionService.list).mockResolvedValue([baseTx]);

    render(<TransactionTracker />);

    await waitFor(() => screen.getByRole('button', { name: /view details for transaction tx-001/i }));
    await userEvent.click(screen.getByRole('button', { name: /view details for transaction tx-001/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('region', { name: /transaction details/i })).not.toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    vi.mocked(transactionService.list).mockRejectedValue(new Error('Network error'));

    render(<TransactionTracker />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('passes params to the service call', async () => {
    vi.mocked(transactionService.list).mockResolvedValue([]);

    render(<TransactionTracker params={{ awardId: 'aw-001', status: 'pending' }} />);

    await waitFor(() => {
      expect(transactionService.list).toHaveBeenCalledWith(
        expect.objectContaining({ awardId: 'aw-001', status: 'pending' })
      );
    });
  });
});
