import { describe, expect, it, vi, beforeEach } from 'vitest';
import { milestoneVerifierService } from '../service';
import type { VerifierDecision } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockDecision: VerifierDecision = {
  id: 'dec-001',
  evidenceId: 'ev-001',
  milestoneId: 'ms-001',
  verifierId: 'verifier-001',
  action: 'approve',
  reasonCode: 'EVIDENCE_COMPLETE',
  decidedAt: '2026-09-25T11:00:00.000Z',
  paymentEligibilityTriggered: true,
};

describe('milestoneVerifierService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assign', () => {
    it('assigns a verifier to an evidence record', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await milestoneVerifierService.assign({ evidenceId: 'ev-001', verifierId: 'verifier-001' });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/milestones/evidence/assign-verifier',
        { evidenceId: 'ev-001', verifierId: 'verifier-001' }
      );
    });

    it('propagates errors from the API', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Verifier not found'));

      await expect(
        milestoneVerifierService.assign({ evidenceId: 'ev-001', verifierId: 'unknown' })
      ).rejects.toThrow('Verifier not found');
    });
  });

  describe('recordDecision', () => {
    it('records an approval and returns decision with payment eligibility triggered', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockDecision);

      const decision = await milestoneVerifierService.recordDecision({
        evidenceId: 'ev-001',
        action: 'approve',
        reasonCode: 'EVIDENCE_COMPLETE',
      });

      expect(decision.action).toBe('approve');
      expect(decision.paymentEligibilityTriggered).toBe(true);
    });

    it('records a rejection without triggering payment', async () => {
      const rejectedDecision: VerifierDecision = {
        ...mockDecision,
        id: 'dec-002',
        action: 'reject',
        reasonCode: 'EVIDENCE_INSUFFICIENT',
        paymentEligibilityTriggered: false,
      };
      vi.mocked(apiClient.post).mockResolvedValue(rejectedDecision);

      const decision = await milestoneVerifierService.recordDecision({
        evidenceId: 'ev-001',
        action: 'reject',
        reasonCode: 'EVIDENCE_INSUFFICIENT',
        reasonNote: 'The uploaded document is incomplete.',
      });

      expect(decision.action).toBe('reject');
      expect(decision.paymentEligibilityTriggered).toBe(false);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/milestones/evidence/decision',
        expect.objectContaining({ reasonNote: 'The uploaded document is incomplete.' })
      );
    });

    it('records a request_changes decision', async () => {
      const changesDecision: VerifierDecision = {
        ...mockDecision,
        id: 'dec-003',
        action: 'request_changes',
        reasonCode: 'CHANGES_REQUIRED',
        paymentEligibilityTriggered: false,
      };
      vi.mocked(apiClient.post).mockResolvedValue(changesDecision);

      const decision = await milestoneVerifierService.recordDecision({
        evidenceId: 'ev-001',
        action: 'request_changes',
        reasonCode: 'CHANGES_REQUIRED',
      });

      expect(decision.action).toBe('request_changes');
    });
  });

  describe('getDecisions', () => {
    it('fetches all decisions for an evidence record', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockDecision]);

      const decisions = await milestoneVerifierService.getDecisions('ev-001');

      expect(decisions).toHaveLength(1);
      expect(decisions[0].evidenceId).toBe('ev-001');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/scholarships/milestones/evidence/ev-001/decisions'
      );
    });

    it('returns empty array when no decisions exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const decisions = await milestoneVerifierService.getDecisions('ev-new');

      expect(decisions).toEqual([]);
    });

    it('ensures approval triggers at most one payment eligibility event', async () => {
      const approvals: VerifierDecision[] = [
        { ...mockDecision, id: 'dec-a', paymentEligibilityTriggered: true },
        { ...mockDecision, id: 'dec-b', paymentEligibilityTriggered: false },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(approvals);

      const decisions = await milestoneVerifierService.getDecisions('ev-001');
      const triggered = decisions.filter((d) => d.paymentEligibilityTriggered);

      expect(triggered).toHaveLength(1);
    });
  });
});
