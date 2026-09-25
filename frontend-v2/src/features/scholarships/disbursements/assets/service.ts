import { apiClient } from '@/src/lib/api-client';
import type {
  AssetConfig,
  AssetValidationResult,
  CreateAssetConfigPayload,
  StellarAsset,
  TrustlineStatus,
  UpdateAssetConfigPayload,
} from './types';

export const assetConfigService = {
  listForProgram: (programId: string): Promise<AssetConfig[]> =>
    apiClient.get<AssetConfig[]>(
      `/scholarships/programs/${encodeURIComponent(programId)}/asset-configs`
    ),

  getById: (id: string): Promise<AssetConfig> =>
    apiClient.get<AssetConfig>(`/scholarships/asset-configs/${encodeURIComponent(id)}`),

  create: (payload: CreateAssetConfigPayload): Promise<AssetConfig> =>
    apiClient.post<AssetConfig>('/scholarships/asset-configs', payload),

  update: (id: string, payload: UpdateAssetConfigPayload): Promise<AssetConfig> =>
    apiClient.patch<AssetConfig>(
      `/scholarships/asset-configs/${encodeURIComponent(id)}`,
      payload
    ),

  validate: (asset: StellarAsset): Promise<AssetValidationResult> =>
    apiClient.post<AssetValidationResult>(
      '/scholarships/asset-configs/validate',
      asset
    ),

  getTrustlineStatus: (
    walletAddress: string,
    assetCode: string,
    assetIssuer?: string
  ): Promise<TrustlineStatus> =>
    apiClient.get<TrustlineStatus>(
      `/scholarships/asset-configs/trustline-status?wallet=${encodeURIComponent(walletAddress)}&code=${encodeURIComponent(assetCode)}${assetIssuer ? `&issuer=${encodeURIComponent(assetIssuer)}` : ''}`
    ),
};
