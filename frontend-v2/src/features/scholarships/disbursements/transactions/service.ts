import { apiClient } from '@/src/lib/api-client';
import type {
  ConfirmTransactionPayload,
  LedgerTransaction,
  TransactionConfirmation,
  TransactionListParams,
} from './types';

export const transactionService = {
  list: (params?: TransactionListParams): Promise<LedgerTransaction[]> => {
    const qs = new URLSearchParams();
    if (params?.awardId) qs.set('awardId', params.awardId);
    if (params?.disbursementIntentId) qs.set('disbursementIntentId', params.disbursementIntentId);
    if (params?.status) qs.set('status', params.status);
    if (params?.page !== undefined) qs.set('page', String(params.page));
    if (params?.pageSize !== undefined) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return apiClient.get<LedgerTransaction[]>(
      `/scholarships/disbursements/transactions${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string): Promise<LedgerTransaction> =>
    apiClient.get<LedgerTransaction>(
      `/scholarships/disbursements/transactions/${encodeURIComponent(id)}`
    ),

  getByDisbursementIntent: (intentId: string): Promise<LedgerTransaction[]> =>
    apiClient.get<LedgerTransaction[]>(
      `/scholarships/disbursements/transactions?disbursementIntentId=${encodeURIComponent(intentId)}`
    ),

  confirm: (payload: ConfirmTransactionPayload): Promise<TransactionConfirmation> =>
    apiClient.post<TransactionConfirmation>(
      '/scholarships/disbursements/transactions/confirm',
      payload
    ),
};
