import { apiClient } from '@/src/lib/api-client';
import type { CredentialClaim, CredentialDecision } from './types';

const BASE = '/mentorship/credentials';

export const credentialService = {
  list: () => apiClient.get<CredentialClaim[]>(`${BASE}`),

  get: (claimId: string) =>
    apiClient.get<CredentialClaim>(`${BASE}/${claimId}`),

  review: (claimId: string, decision: CredentialDecision, reason?: string) =>
    apiClient.post<{ claimId: string }>(`${BASE}/${claimId}/review`, {
      decision,
      reason,
    }),
};
