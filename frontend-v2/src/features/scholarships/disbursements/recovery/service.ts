import { apiClient } from '@/src/lib/api-client';
import type {
  DiagnosticReport,
  PayoutFailure,
  RetryPayload,
  RetryResult,
} from './types';

export const recoveryService = {
  listFailures: (params?: { programId?: string; awardId?: string }): Promise<PayoutFailure[]> => {
    const qs = new URLSearchParams();
    if (params?.programId) qs.set('programId', params.programId);
    if (params?.awardId) qs.set('awardId', params.awardId);
    const query = qs.toString();
    return apiClient.get<PayoutFailure[]>(
      `/scholarships/disbursements/failures${query ? `?${query}` : ''}`
    );
  },

  getDiagnostics: (failureId: string): Promise<DiagnosticReport> =>
    apiClient.get<DiagnosticReport>(
      `/scholarships/disbursements/failures/${encodeURIComponent(failureId)}/diagnostics`
    ),

  retry: (payload: RetryPayload): Promise<RetryResult> =>
    apiClient.post<RetryResult>(
      '/scholarships/disbursements/failures/retry',
      payload
    ),

  acknowledgeFailure: (failureId: string): Promise<void> =>
    apiClient.patch<void>(
      `/scholarships/disbursements/failures/${encodeURIComponent(failureId)}/acknowledge`,
      {}
    ),
};
