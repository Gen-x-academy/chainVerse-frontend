'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduledPaymentService } from './service';
import { applyScholarshipInvalidation } from '../../lib/invalidation';
import { useScholarshipKeys } from '../../lib/useScholarshipKeys';
import type { PaymentBatchRequest, PaymentBatchResult, ScheduledPayment } from './types';

/** Installments that are due and eligible to be settled. */
export function useDueScheduledPayments(params?: {
  programId?: string;
  limit?: number;
}) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.payments.list({ due: true, ...params }),
    queryFn: () => scheduledPaymentService.listDue(params),
  });
}

/** One batch's outcome, including per-item failures. */
export function usePaymentBatch(batchId: string | undefined) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.payments.at('batch', batchId ?? ''),
    queryFn: () => scheduledPaymentService.getBatch(batchId as string),
    enabled: Boolean(batchId),
  });
}

export function usePaymentBatches(programId?: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.payments.list({ batches: true, programId }),
    queryFn: () => scheduledPaymentService.listBatches(programId),
  });
}

/**
 * Execute a bounded, idempotent payment batch (#1227).
 *
 * This was raw `useState` inside `PaymentExecutionPanel`, so executing a batch
 * left the payment queue, the disbursement view, the affected schedules and the
 * transaction log showing pre-batch data until a manual reload. The mutation
 * routes the fan-out through the `payment.batch.execute` matrix row.
 *
 * A dry run is deliberately *not* an invalidation: it commits no transactions,
 * so there is nothing to converge on and refetching would be wasted work.
 */
export function useExecutePaymentBatch() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (payload: PaymentBatchRequest) =>
      scheduledPaymentService.executeBatch(payload),
    onSuccess: async (result: PaymentBatchResult, variables: PaymentBatchRequest) => {
      if (variables.dryRun) return;
      await applyScholarshipInvalidation(queryClient, keys, 'payment.batch.execute');
      // The batch result itself is the freshest source for its own view.
      queryClient.setQueryData(keys.payments.at('batch', result.batchId), result);
    },
  });
}
