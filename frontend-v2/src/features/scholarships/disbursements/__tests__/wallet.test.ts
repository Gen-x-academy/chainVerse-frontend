import { describe, expect, it, vi, beforeEach } from 'vitest';
import { walletValidationService } from '../service';
import type { WalletChallenge, WalletValidationResult } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockChallenge: WalletChallenge = {
  challengeId: 'ch-001',
  walletAddress: 'GABC123XYZ',
  challengeText: 'chainverse:wallet-ownership:GABC123XYZ:1727258400000',
  issuedAt: '2026-09-25T12:00:00.000Z',
  expiresAt: '2026-09-25T12:05:00.000Z',
  status: 'pending',
};

const mockValidationResult: WalletValidationResult = {
  verified: true,
  walletAddress: 'GABC123XYZ',
  verifiedAt: '2026-09-25T12:01:30.000Z',
  paymentsOnHold: false,
};

describe('walletValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestChallenge', () => {
    it('requests a domain-separated challenge for a wallet address', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockChallenge);

      const challenge = await walletValidationService.requestChallenge('GABC123XYZ');

      expect(challenge.challengeId).toBe('ch-001');
      expect(challenge.walletAddress).toBe('GABC123XYZ');
      expect(challenge.status).toBe('pending');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/disbursements/wallet-challenges',
        { walletAddress: 'GABC123XYZ' }
      );
    });

    it('challenge has an expiry time', () => {
      const issued = new Date(mockChallenge.issuedAt).getTime();
      const expires = new Date(mockChallenge.expiresAt).getTime();

      expect(expires).toBeGreaterThan(issued);
    });

    it('challenge text includes domain separation', () => {
      expect(mockChallenge.challengeText).toMatch(/^chainverse:/);
    });

    it('propagates errors when the server rejects the request', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Invalid wallet address'));

      await expect(
        walletValidationService.requestChallenge('INVALID')
      ).rejects.toThrow('Invalid wallet address');
    });
  });

  describe('submitSignature', () => {
    it('verifies a valid signature and returns verified=true', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockValidationResult);

      const result = await walletValidationService.submitSignature({
        challengeId: 'ch-001',
        walletAddress: 'GABC123XYZ',
        signature: 'base64-sig-here',
        publicKey: 'GABC123XYZ',
      });

      expect(result.verified).toBe(true);
      expect(result.walletAddress).toBe('GABC123XYZ');
      expect(result.paymentsOnHold).toBe(false);
    });

    it('returns verified=false on invalid signature', async () => {
      const failResult: WalletValidationResult = {
        verified: false,
        walletAddress: 'GABC123XYZ',
        paymentsOnHold: false,
      };
      vi.mocked(apiClient.post).mockResolvedValue(failResult);

      const result = await walletValidationService.submitSignature({
        challengeId: 'ch-001',
        walletAddress: 'GABC123XYZ',
        signature: 'bad-sig',
        publicKey: 'GABC123XYZ',
      });

      expect(result.verified).toBe(false);
    });

    it('propagates errors from the API', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Challenge expired'));

      await expect(
        walletValidationService.submitSignature({
          challengeId: 'ch-expired',
          walletAddress: 'GABC123XYZ',
          signature: 'any-sig',
          publicKey: 'GABC123XYZ',
        })
      ).rejects.toThrow('Challenge expired');
    });
  });

  describe('updateWalletAddress', () => {
    it('places pending payments on hold when address changes', async () => {
      const holdResult: WalletValidationResult = {
        verified: true,
        walletAddress: 'GNEW456ABC',
        verifiedAt: '2026-09-25T13:00:00.000Z',
        paymentsOnHold: true,
        holdReason: 'Address change requires re-verification',
      };
      vi.mocked(apiClient.put).mockResolvedValue(holdResult);

      const result = await walletValidationService.updateWalletAddress({
        recipientId: 'user-001',
        newWalletAddress: 'GNEW456ABC',
      });

      expect(result.paymentsOnHold).toBe(true);
      expect(result.holdReason).toBeTruthy();
      expect(result.walletAddress).toBe('GNEW456ABC');
    });

    it('calls the correct endpoint with the recipient ID', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ verified: true, walletAddress: 'GNEW', paymentsOnHold: true });

      await walletValidationService.updateWalletAddress({
        recipientId: 'user-001',
        newWalletAddress: 'GNEW456ABC',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/scholarships/disbursements/wallet-address/user-001',
        expect.objectContaining({ newWalletAddress: 'GNEW456ABC' })
      );
    });
  });
});
