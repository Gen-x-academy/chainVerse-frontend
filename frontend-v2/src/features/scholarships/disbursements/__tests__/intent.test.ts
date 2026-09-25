import { describe, expect, it, vi, beforeEach } from 'vitest';
import { disbursementService } from '../service';
import type { CreateIntentResult, DisbursementIntent } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockIntent: DisbursementIntent = {
  id: 'intent-001',
  intentKey: 'intent-key-abc',
  awardId: 'aw-001',
  installmentId: 'inst-001',
  recipientId: 'user-001',
  recipientWalletAddress: 'GABC123XYZ',
  amount: '100',
  currency: 'XLM',
  status: 'pending',
  createdAt: '2026-09-25T12:00:00.000Z',
};

describe('disbursementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIntent', () => {
    it('creates a new intent and returns isNew=true', async () => {
      const result: CreateIntentResult = { intent: mockIntent, isNew: true };
      vi.mocked(apiClient.post).mockResolvedValue(result);

      const response = await disbursementService.createIntent({
        intentKey: 'intent-key-abc',
        awardId: 'aw-001',
        installmentId: 'inst-001',
        recipientId: 'user-001',
        recipientWalletAddress: 'GABC123XYZ',
        amount: '100',
        currency: 'XLM',
      });

      expect(response.isNew).toBe(true);
      expect(response.intent.intentKey).toBe('intent-key-abc');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/disbursements/intents',
        expect.objectContaining({ intentKey: 'intent-key-abc' })
      );
    });

    it('returns isNew=false for duplicate intent key (idempotent)', async () => {
      const result: CreateIntentResult = { intent: mockIntent, isNew: false };
      vi.mocked(apiClient.post).mockResolvedValue(result);

      const response = await disbursementService.createIntent({
        intentKey: 'intent-key-abc',
        awardId: 'aw-001',
        installmentId: 'inst-001',
        recipientId: 'user-001',
        recipientWalletAddress: 'GABC123XYZ',
        amount: '100',
        currency: 'XLM',
      });

      expect(response.isNew).toBe(false);
      expect(response.intent).toEqual(mockIntent);
    });

    it('the returned intent has immutable amount and recipient', async () => {
      const result: CreateIntentResult = { intent: mockIntent, isNew: true };
      vi.mocked(apiClient.post).mockResolvedValue(result);

      const response = await disbursementService.createIntent({
        intentKey: 'intent-key-abc',
        awardId: 'aw-001',
        installmentId: 'inst-001',
        recipientId: 'user-001',
        recipientWalletAddress: 'GABC123XYZ',
        amount: '100',
        currency: 'XLM',
      });

      expect(response.intent.amount).toBe('100');
      expect(response.intent.recipientWalletAddress).toBe('GABC123XYZ');
      expect(response.intent.recipientId).toBe('user-001');
    });

    it('propagates API errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Insufficient balance'));

      await expect(
        disbursementService.createIntent({
          intentKey: 'intent-key-fail',
          awardId: 'aw-001',
          installmentId: 'inst-001',
          recipientId: 'user-001',
          recipientWalletAddress: 'GABC123XYZ',
          amount: '0',
          currency: 'XLM',
        })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('getIntent', () => {
    it('fetches a single intent by ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(mockIntent);

      const intent = await disbursementService.getIntent('intent-001');

      expect(intent.id).toBe('intent-001');
      expect(apiClient.get).toHaveBeenCalledWith('/scholarships/disbursements/intents/intent-001');
    });
  });

  describe('listIntents', () => {
    it('fetches all intents for an award', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockIntent]);

      const intents = await disbursementService.listIntents('aw-001');

      expect(intents).toHaveLength(1);
      expect(intents[0].awardId).toBe('aw-001');
    });

    it('returns empty array when no intents exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const intents = await disbursementService.listIntents('aw-new');

      expect(intents).toEqual([]);
    });
  });
});
