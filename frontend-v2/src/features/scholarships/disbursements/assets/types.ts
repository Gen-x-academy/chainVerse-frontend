export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

export type AssetType = 'native' | 'issued';

export type StellarAsset = {
  code: string;
  type: AssetType;
  issuer?: string;
  decimals: number;
  network: StellarNetwork;
};

export type TrustlineRequirement = {
  required: boolean;
  reason: string;
  setupGuideUrl?: string;
};

export type AssetConfigStatus = 'pending_review' | 'approved' | 'rejected' | 'deprecated';

export type AssetConfig = {
  id: string;
  programId: string;
  asset: StellarAsset;
  trustlineRequirement: TrustlineRequirement;
  status: AssetConfigStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAssetConfigPayload = {
  programId: string;
  asset: StellarAsset;
  trustlineRequirement: TrustlineRequirement;
};

export type UpdateAssetConfigPayload = {
  trustlineRequirement?: TrustlineRequirement;
  status?: AssetConfigStatus;
};

export type AssetValidationResult = {
  valid: boolean;
  asset: StellarAsset;
  supported: boolean;
  failureReasons: string[];
};

export type TrustlineStatus = {
  walletAddress: string;
  asset: StellarAsset;
  established: boolean;
  limit?: string;
  balance?: string;
};
