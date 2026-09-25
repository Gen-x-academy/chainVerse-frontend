import { apiClient } from '@/src/lib/api-client';
import type {
  CreateIntentPayload,
  CreateIntentResult,
  DisbursementIntent,
  SubmitSignaturePayload,
  UpdateWalletAddressPayload,
  WalletChallenge,
  WalletValidationResult,
} from './types';

export const disbursementService = {
  createIntent: (payload: CreateIntentPayload): Promise<CreateIntentResult> =>
    apiClient.post<CreateIntentResult>(
      '/scholarships/disbursements/intents',
      payload
    ),

  getIntent: (intentId: string): Promise<DisbursementIntent> =>
    apiClient.get<DisbursementIntent>(
      `/scholarships/disbursements/intents/${intentId}`
    ),

  listIntents: (awardId: string): Promise<DisbursementIntent[]> =>
    apiClient.get<DisbursementIntent[]>(
      `/scholarships/disbursements/intents?awardId=${encodeURIComponent(awardId)}`
    ),
};

export const walletValidationService = {
  requestChallenge: (walletAddress: string): Promise<WalletChallenge> =>
    apiClient.post<WalletChallenge>(
      '/scholarships/disbursements/wallet-challenges',
      { walletAddress }
    ),

  submitSignature: (payload: SubmitSignaturePayload): Promise<WalletValidationResult> =>
    apiClient.post<WalletValidationResult>(
      '/scholarships/disbursements/wallet-challenges/verify',
      payload
    ),

  updateWalletAddress: (payload: UpdateWalletAddressPayload): Promise<WalletValidationResult> =>
    apiClient.put<WalletValidationResult>(
      `/scholarships/disbursements/wallet-address/${encodeURIComponent(payload.recipientId)}`,
      payload
    ),
};
