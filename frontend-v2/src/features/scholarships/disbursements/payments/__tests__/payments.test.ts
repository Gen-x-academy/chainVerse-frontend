import { describe, expect, it, vi, beforeEach } from 'vitest';
import { scheduledPaymentService } from '../service';
import type { PaymentBatchResult, ScheduledPayment } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockPayment: ScheduledPayment = {
  id: 'sp-001',
  awardId: 'aw-001',
  installmentId: 'inst-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  scheduledAt: '2026-09-25T12:00:00.000Z',
  status: 'due',
  programId: 'prog-001',
};

const mockBatchResult: PaymentBatchResult = {
  batchId: 'batch-001',
  batchKey: 'batch-key-abc',
  status: 'completed',
  totalItems: 2,
  successCount: 2,
  failureCount: 0,
  outcomes: [
    { scheduledPaymentId: 'sp-001', disbursementIntentId: 'intent-001', success: true, ledgerRef: 'ledger-ref-1' },
    { scheduledPaymentId: 'sp-002', disbursementIntentId: 'intent-002', success: true, ledgerRef: 'ledger-ref-2' },
  ],
  startedAt: '2026-09-25T12:00:00.000Z',
  completedAt: '2026-09-25T12:00:10.000Z',
};

describe('scheduledPaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDue', () => {
    it('returns due payments for a program', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockPayment]);

      const payments = await scheduledPaymentService.listDue({ programId: 'prog-001' });

      expect(payments).toHaveLength(1);
      expect(payments[0].status).toBe('due');
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('programId=prog-001')
      );
    });

    it('returns empty array when no payments are due', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const payments = await scheduledPaymentService.listDue();

      expect(payments).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockPayment]);

      await scheduledPaymentService.listDue({ limit: 10 });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
    });
  });

  describe('executeBatch', () => {
    it('executes a batch and returns outcomes', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockBatchResult);

      const result = await scheduledPaymentService.executeBatch({
        batchKey: 'batch-key-abc',
        programId: 'prog-001',
        maxItems: 50,
      });

      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.outcomes).toHaveLength(2);
    });

    it('only authorized automation executes — propagates unauthorized error', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('403 Forbidden'));

      await expect(
        scheduledPaymentService.executeBatch({
          batchKey: 'batch-unauthorized',
          maxItems: 50,
        })
      ).rejects.toThrow('403 Forbidden');
    });

    it('returns isomorphic outcomes for partial batch failure', async () => {
      const partialResult: PaymentBatchResult = {
        ...mockBatchResult,
        status: 'partially_failed',
        successCount: 1,
        failureCount: 1,
        outcomes: [
          { scheduledPaymentId: 'sp-001', disbursementIntentId: 'intent-001', success: true, ledgerRef: 'ledger-ref-1' },
          { scheduledPaymentId: 'sp-002', success: false, failureReason: 'Insufficient funds' },
        ],
      };
      vi.mocked(apiClient.post).mockResolvedValue(partialResult);

      const result = await scheduledPaymentService.executeBatch({
        batchKey: 'batch-partial',
        maxItems: 50,
      });

      expect(result.status).toBe('partially_failed');
      expect(result.outcomes.find((o) => !o.success)?.failureReason).toBe('Insufficient funds');
    });

    it('successful payments include ledger references', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockBatchResult);

      const result = await scheduledPaymentService.executeBatch({
        batchKey: 'batch-key-abc',
        maxItems: 50,
      });

      result.outcomes.filter((o) => o.success).forEach((o) => {
        expect(o.ledgerRef).toBeTruthy();
      });
    });

    it('same batch key returns same result (idempotent)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockBatchResult);

      const r1 = await scheduledPaymentService.executeBatch({ batchKey: 'same-key', maxItems: 50 });
      const r2 = await scheduledPaymentService.executeBatch({ batchKey: 'same-key', maxItems: 50 });

      expect(r1.batchId).toBe(r2.batchId);
    });
  });

  describe('getBatch', () => {
    it('fetches a batch by ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(mockBatchResult);

      const result = await scheduledPaymentService.getBatch('batch-001');

      expect(result.batchId).toBe('batch-001');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/scholarships/disbursements/batches/batch-001'
      );
    });
  });

  describe('listBatches', () => {
    it('lists all batches, optionally filtered by programId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockBatchResult]);

      const batches = await scheduledPaymentService.listBatches('prog-001');

      expect(batches).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('programId=prog-001')
      );
    });
  });
});
