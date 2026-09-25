import { apiClient } from '@/src/lib/api-client';
import type {
  PaymentBatchRequest,
  PaymentBatchResult,
  ScheduledPayment,
} from './types';

export const scheduledPaymentService = {
  listDue: (params?: { programId?: string; limit?: number }): Promise<ScheduledPayment[]> => {
    const qs = new URLSearchParams();
    if (params?.programId) qs.set('programId', params.programId);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiClient.get<ScheduledPayment[]>(
      `/scholarships/disbursements/scheduled${query ? `?${query}` : ''}`
    );
  },

  executeBatch: (payload: PaymentBatchRequest): Promise<PaymentBatchResult> =>
    apiClient.post<PaymentBatchResult>(
      '/scholarships/disbursements/batches',
      payload
    ),

  getBatch: (batchId: string): Promise<PaymentBatchResult> =>
    apiClient.get<PaymentBatchResult>(
      `/scholarships/disbursements/batches/${encodeURIComponent(batchId)}`
    ),

  listBatches: (programId?: string): Promise<PaymentBatchResult[]> => {
    const qs = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<PaymentBatchResult[]>(
      `/scholarships/disbursements/batches${qs}`
    );
  },
};
