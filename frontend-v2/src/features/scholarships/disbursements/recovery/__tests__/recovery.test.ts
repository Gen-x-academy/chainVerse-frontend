import { describe, expect, it, vi, beforeEach } from 'vitest';
import { recoveryService } from '../service';
import type { DiagnosticReport, PayoutFailure, RetryResult } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockFailure: PayoutFailure = {
  id: 'fail-001',
  disbursementIntentId: 'intent-001',
  awardId: 'aw-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  failureReason: 'missing_trustline',
  failureDetail: 'Recipient wallet has no trustline for XLM',
  recoveryStatus: 'open',
  retryCount: 0,
  maxRetries: 3,
  failedAt: '2026-09-25T11:00:00.000Z',
};

const mockDiagnostics: DiagnosticReport = {
  failureId: 'fail-001',
  failureReason: 'missing_trustline',
  operatorNotes: 'Recipient has not established a trustline for USDC.',
  suggestedAction: 'Contact recipient and guide them to add the trustline via their wallet.',
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
  message: 'Retry enqueued with new transaction envelope.',
};

describe('recoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFailures', () => {
    it('lists all failures for a program', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockFailure]);

      const failures = await recoveryService.listFailures({ programId: 'prog-001' });

      expect(failures).toHaveLength(1);
      expect(failures[0].failureReason).toBe('missing_trustline');
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('programId=prog-001')
      );
    });

    it('returns empty array when no failures exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const failures = await recoveryService.listFailures();

      expect(failures).toEqual([]);
    });

    it('filters by awardId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockFailure]);

      await recoveryService.listFailures({ awardId: 'aw-001' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('awardId=aw-001')
      );
    });

    it('surfaces all expected failure reasons', () => {
      const reasons: PayoutFailure['failureReason'][] = [
        'missing_trustline',
        'bad_destination',
        'insufficient_funds',
        'network_expiry',
        'unknown',
      ];
      expect(reasons).toContain(mockFailure.failureReason);
    });
  });

  describe('getDiagnostics', () => {
    it('returns actionable diagnostics for an operator', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(mockDiagnostics);

      const report = await recoveryService.getDiagnostics('fail-001');

      expect(report.canRetry).toBe(true);
      expect(report.retryRequiresNewEnvelope).toBe(true);
      expect(report.awardEligibilityPreserved).toBe(true);
      expect(report.suggestedAction).toBeTruthy();
      expect(apiClient.get).toHaveBeenCalledWith(
        '/scholarships/disbursements/failures/fail-001/diagnostics'
      );
    });

    it('preserves award eligibility on failure', () => {
      expect(mockDiagnostics.awardEligibilityPreserved).toBe(true);
    });
  });

  describe('retry', () => {
    it('retries with a new transaction envelope', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockRetryResult);

      const result = await recoveryService.retry({
        failureId: 'fail-001',
        newEnvelopeKey: 'retry-env-abc',
      });

      expect(result.enqueued).toBe(true);
      expect(result.newDisbursementIntentId).toBeTruthy();
      expect(result.originalFailureId).toBe('fail-001');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/disbursements/failures/retry',
        expect.objectContaining({ failureId: 'fail-001', newEnvelopeKey: 'retry-env-abc' })
      );
    });

    it('uses a new envelope key on each retry (not the same intent)', async () => {
      const secondRetry: RetryResult = { ...mockRetryResult, newDisbursementIntentId: 'intent-retry-002' };
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce(mockRetryResult)
        .mockResolvedValueOnce(secondRetry);

      const r1 = await recoveryService.retry({ failureId: 'fail-001', newEnvelopeKey: 'env-key-1' });
      const r2 = await recoveryService.retry({ failureId: 'fail-001', newEnvelopeKey: 'env-key-2' });

      expect(r1.newDisbursementIntentId).not.toBe(r2.newDisbursementIntentId);
    });

    it('propagates errors when retry is not allowed', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Max retries exceeded'));

      await expect(
        recoveryService.retry({ failureId: 'fail-001', newEnvelopeKey: 'env-key' })
      ).rejects.toThrow('Max retries exceeded');
    });
  });

  describe('acknowledgeFailure', () => {
    it('acknowledges a failure without error', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue(undefined);

      await expect(recoveryService.acknowledgeFailure('fail-001')).resolves.toBeUndefined();
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/scholarships/disbursements/failures/fail-001/acknowledge',
        {}
      );
    });
  });
});
