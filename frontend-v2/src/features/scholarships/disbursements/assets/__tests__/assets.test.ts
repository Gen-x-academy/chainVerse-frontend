import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assetConfigService } from '../service';
import type { AssetConfig, AssetValidationResult, TrustlineStatus } from '../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockAssetConfig: AssetConfig = {
  id: 'ac-001',
  programId: 'prog-001',
  asset: {
    code: 'USDC',
    type: 'issued',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    decimals: 7,
    network: 'testnet',
  },
  trustlineRequirement: {
    required: true,
    reason: 'Issued asset requires a trustline to receive payments.',
  },
  status: 'approved',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
};

describe('assetConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listForProgram', () => {
    it('returns all asset configs for a program', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([mockAssetConfig]);

      const configs = await assetConfigService.listForProgram('prog-001');

      expect(configs).toHaveLength(1);
      expect(configs[0].asset.code).toBe('USDC');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/scholarships/programs/prog-001/asset-configs'
      );
    });

    it('returns empty array when no assets configured', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const configs = await assetConfigService.listForProgram('prog-empty');

      expect(configs).toEqual([]);
    });

    it('propagates API errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Unauthorized'));

      await expect(assetConfigService.listForProgram('prog-001')).rejects.toThrow('Unauthorized');
    });
  });

  describe('create', () => {
    it('creates an asset config for an issued asset', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(mockAssetConfig);

      const result = await assetConfigService.create({
        programId: 'prog-001',
        asset: {
          code: 'USDC',
          type: 'issued',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          decimals: 7,
          network: 'testnet',
        },
        trustlineRequirement: {
          required: true,
          reason: 'Issued asset requires a trustline.',
        },
      });

      expect(result.asset.type).toBe('issued');
      expect(result.trustlineRequirement.required).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/scholarships/asset-configs',
        expect.objectContaining({ programId: 'prog-001' })
      );
    });

    it('creates an asset config for native XLM (no trustline required)', async () => {
      const nativeConfig: AssetConfig = {
        ...mockAssetConfig,
        id: 'ac-002',
        asset: { code: 'XLM', type: 'native', decimals: 7, network: 'testnet' },
        trustlineRequirement: { required: false, reason: 'Native asset; no trustline needed.' },
      };
      vi.mocked(apiClient.post).mockResolvedValue(nativeConfig);

      const result = await assetConfigService.create({
        programId: 'prog-001',
        asset: { code: 'XLM', type: 'native', decimals: 7, network: 'testnet' },
        trustlineRequirement: { required: false, reason: 'Native asset; no trustline needed.' },
      });

      expect(result.asset.type).toBe('native');
      expect(result.trustlineRequirement.required).toBe(false);
      expect(result.asset.issuer).toBeUndefined();
    });

    it('propagates unsupported asset errors early', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Asset not supported on this network'));

      await expect(
        assetConfigService.create({
          programId: 'prog-001',
          asset: { code: 'BADTOKEN', type: 'issued', decimals: 7, network: 'testnet' },
          trustlineRequirement: { required: true, reason: 'unknown' },
        })
      ).rejects.toThrow('Asset not supported on this network');
    });
  });

  describe('update', () => {
    it('updates trustline requirement for an existing config', async () => {
      const updated: AssetConfig = {
        ...mockAssetConfig,
        trustlineRequirement: { required: false, reason: 'No longer required.' },
      };
      vi.mocked(apiClient.patch).mockResolvedValue(updated);

      const result = await assetConfigService.update('ac-001', {
        trustlineRequirement: { required: false, reason: 'No longer required.' },
      });

      expect(result.trustlineRequirement.required).toBe(false);
      expect(apiClient.patch).toHaveBeenCalledWith('/scholarships/asset-configs/ac-001', expect.any(Object));
    });
  });

  describe('validate', () => {
    it('returns valid=true for a supported asset', async () => {
      const validResult: AssetValidationResult = {
        valid: true,
        asset: mockAssetConfig.asset,
        supported: true,
        failureReasons: [],
      };
      vi.mocked(apiClient.post).mockResolvedValue(validResult);

      const result = await assetConfigService.validate(mockAssetConfig.asset);

      expect(result.valid).toBe(true);
      expect(result.failureReasons).toHaveLength(0);
    });

    it('returns valid=false with failure reasons for unsupported asset', async () => {
      const invalidResult: AssetValidationResult = {
        valid: false,
        asset: { code: 'BADTOKEN', type: 'issued', decimals: 7, network: 'testnet' },
        supported: false,
        failureReasons: ['Issuer account not found on network'],
      };
      vi.mocked(apiClient.post).mockResolvedValue(invalidResult);

      const result = await assetConfigService.validate({
        code: 'BADTOKEN',
        type: 'issued',
        decimals: 7,
        network: 'testnet',
      });

      expect(result.valid).toBe(false);
      expect(result.failureReasons).toContain('Issuer account not found on network');
    });
  });

  describe('getTrustlineStatus', () => {
    it('returns established=true when trustline exists', async () => {
      const established: TrustlineStatus = {
        walletAddress: 'GABC123',
        asset: mockAssetConfig.asset,
        established: true,
        limit: '9223372036854775807',
        balance: '100.0000000',
      };
      vi.mocked(apiClient.get).mockResolvedValue(established);

      const result = await assetConfigService.getTrustlineStatus('GABC123', 'USDC', 'GA5ZS...');

      expect(result.established).toBe(true);
      expect(result.balance).toBeDefined();
    });

    it('returns established=false for a missing trustline', async () => {
      const missing: TrustlineStatus = {
        walletAddress: 'GABC123',
        asset: mockAssetConfig.asset,
        established: false,
      };
      vi.mocked(apiClient.get).mockResolvedValue(missing);

      const result = await assetConfigService.getTrustlineStatus('GABC123', 'USDC');

      expect(result.established).toBe(false);
      expect(result.balance).toBeUndefined();
    });
  });
});
