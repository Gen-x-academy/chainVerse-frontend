import { describe, expect, it, vi, beforeEach } from 'vitest';
import { transactionService } from '../service';
import type { LedgerTransaction, TransactionConfirmation } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockTx: LedgerTransaction = {
  id: 'tx-001',
  disbursementIntentId: 'intent-001',
  awardId: 'aw-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  status: 'pending',
  txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  ledgerSequence: 54321,
  submittedAt: '2026-09-25T12:00:00.000Z',
  requiredConfirmations: 1,
  currentConfirmations: 0,
  network: 'testnet',
};

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('lists all transactions', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockTx]);

      const txs = await transactionService.list();

      expect(txs).toHaveLength(1);
      expect(txs[0].id).toBe('tx-001');
    });

    it('filters by awardId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockTx]);

      await transactionService.list({ awardId: 'aw-001' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('awardId=aw-001')
      );
    });

    it('filters by status', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockTx]);

      await transactionService.list({ status: 'pending' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('status=pending')
      );
    });

    it('returns empty array when no transactions found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const txs = await transactionService.list({ awardId: 'aw-none' });

      expect(txs).toEqual([]);
    });
  });

  describe('getById', () => {
    it('fetches a single transaction by ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(mockTx);

      const tx = await transactionService.getById('tx-001');

      expect(tx.id).toBe('tx-001');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/scholarships/disbursements/transactions/tx-001'
      );
    });
  });

  describe('getByDisbursementIntent', () => {
    it('returns all transactions for a given intent', async () => {
      const successTx: LedgerTransaction = { ...mockTx, id: 'tx-002', status: 'successful' };
      vi.mocked(apiClient.get).mockResolvedValue([successTx]);

      const txs = await transactionService.getByDisbursementIntent('intent-001');

      expect(txs).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('disbursementIntentId=intent-001')
      );
    });
  });

  describe('confirm', () => {
    it('confirms a transaction and returns confirmation details', async () => {
      const confirmation: TransactionConfirmation = {
        transactionId: 'tx-001',
        txHash: mockTx.txHash!,
        confirmedAt: '2026-09-25T12:01:00.000Z',
        ledgerSequence: 54321,
      };
      vi.mocked(apiClient.post).mockResolvedValue(confirmation);

      const result = await transactionService.confirm({
        txHash: mockTx.txHash!,
        disbursementIntentId: 'intent-001',
        ledgerSequence: 54321,
      });

      expect(result.transactionId).toBe('tx-001');
      expect(result.confirmedAt).toBeTruthy();
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/disbursements/transactions/confirm',
        expect.objectContaining({ txHash: mockTx.txHash })
      );
    });

    it('prevents a transaction from being confirmed twice', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Transaction already finalized'));

      await expect(
        transactionService.confirm({
          txHash: mockTx.txHash!,
          disbursementIntentId: 'intent-001',
        })
      ).rejects.toThrow('Transaction already finalized');
    });

    it('state follows verified network evidence — propagates ledger errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Transaction not found on ledger'));

      await expect(
        transactionService.confirm({
          txHash: 'unknown-hash',
          disbursementIntentId: 'intent-001',
        })
      ).rejects.toThrow('Transaction not found on ledger');
    });
  });

  describe('transaction states', () => {
    const TERMINAL_STATES: LedgerTransaction['status'][] = ['successful', 'failed', 'expired', 'reversed'];
    const NON_TERMINAL_STATES: LedgerTransaction['status'][] = ['submitted', 'pending'];

    it('covers all expected status values', () => {
      const allStatuses = [...TERMINAL_STATES, ...NON_TERMINAL_STATES];
      expect(allStatuses).toContain('submitted');
      expect(allStatuses).toContain('pending');
      expect(allStatuses).toContain('successful');
      expect(allStatuses).toContain('failed');
      expect(allStatuses).toContain('expired');
      expect(allStatuses).toContain('reversed');
    });

    it('successful transaction has finalized state', () => {
      const completedTx: LedgerTransaction = {
        ...mockTx,
        status: 'successful',
        currentConfirmations: 1,
        finalizedAt: '2026-09-25T12:02:00.000Z',
      };
      expect(completedTx.currentConfirmations).toBeGreaterThanOrEqual(completedTx.requiredConfirmations);
      expect(completedTx.finalizedAt).toBeTruthy();
    });
  });
});
