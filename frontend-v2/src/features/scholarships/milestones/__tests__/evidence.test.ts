import { describe, expect, it, vi, beforeEach } from 'vitest';
import { milestoneEvidenceService } from '../service';
import type { MilestoneEvidence, SubmitEvidenceResult } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockEvidence: MilestoneEvidence = {
  id: 'ev-001',
  milestoneId: 'ms-001',
  awardId: 'aw-001',
  recipientId: 'user-001',
  evidenceType: 'document',
  contentHash: 'sha256-abc123',
  encryptedOffChain: false,
  submittedAt: '2026-09-25T10:00:00.000Z',
  submissionKey: 'key-001',
  version: 1,
  versionHistory: [
    { version: 1, contentHash: 'sha256-abc123', submittedAt: '2026-09-25T10:00:00.000Z', submissionKey: 'key-001' },
  ],
};

describe('milestoneEvidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submit', () => {
    it('returns evidence and isNew=true on first submission', async () => {
      const result: SubmitEvidenceResult = { evidence: mockEvidence, isNew: true };
      vi.mocked(apiClient.post).mockResolvedValue(result);

      const response = await milestoneEvidenceService.submit({
        milestoneId: 'ms-001',
        awardId: 'aw-001',
        evidenceType: 'document',
        content: 'https://example.com/doc.pdf',
        submissionKey: 'key-001',
      });

      expect(response.isNew).toBe(true);
      expect(response.evidence.id).toBe('ev-001');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/milestones/evidence',
        expect.objectContaining({ submissionKey: 'key-001' })
      );
    });

    it('returns isNew=false on duplicate submission (idempotent)', async () => {
      const result: SubmitEvidenceResult = { evidence: mockEvidence, isNew: false };
      vi.mocked(apiClient.post).mockResolvedValue(result);

      const response = await milestoneEvidenceService.submit({
        milestoneId: 'ms-001',
        awardId: 'aw-001',
        evidenceType: 'document',
        content: 'https://example.com/doc.pdf',
        submissionKey: 'key-001',
      });

      expect(response.isNew).toBe(false);
      expect(response.evidence).toEqual(mockEvidence);
    });

    it('propagates API errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

      await expect(
        milestoneEvidenceService.submit({
          milestoneId: 'ms-001',
          awardId: 'aw-001',
          evidenceType: 'document',
          content: 'some-content',
          submissionKey: 'key-002',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('getByMilestone', () => {
    it('fetches evidence list for a milestone', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockEvidence]);

      const evidence = await milestoneEvidenceService.getByMilestone('ms-001');

      expect(evidence).toHaveLength(1);
      expect(evidence[0].milestoneId).toBe('ms-001');
      expect(apiClient.get).toHaveBeenCalledWith('/scholarships/milestones/ms-001/evidence');
    });

    it('returns empty array when no evidence exists', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const evidence = await milestoneEvidenceService.getByMilestone('ms-empty');

      expect(evidence).toEqual([]);
    });
  });

  describe('getById', () => {
    it('fetches a single evidence record', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(mockEvidence);

      const evidence = await milestoneEvidenceService.getById('ev-001');

      expect(evidence.id).toBe('ev-001');
      expect(apiClient.get).toHaveBeenCalledWith('/scholarships/milestones/evidence/ev-001');
    });
  });

  describe('encryption flag', () => {
    it('passes encryptOffChain flag to the API', async () => {
      const encryptedEvidence: MilestoneEvidence = { ...mockEvidence, encryptedOffChain: true };
      vi.mocked(apiClient.post).mockResolvedValue({ evidence: encryptedEvidence, isNew: true });

      const response = await milestoneEvidenceService.submit({
        milestoneId: 'ms-001',
        awardId: 'aw-001',
        evidenceType: 'attestation',
        content: 'I confirm my status',
        encryptOffChain: true,
        submissionKey: 'key-003',
      });

      expect(response.evidence.encryptedOffChain).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/milestones/evidence',
        expect.objectContaining({ encryptOffChain: true })
      );
    });
  });
});
