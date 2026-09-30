'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scholarshipWithdrawalService } from './service';
import { applyScholarshipInvalidation } from '../lib/invalidation';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';
import type { WithdrawalRecord, WithdrawalRequest } from './types';

/**
 * Submit a scholarship withdrawal (#1227).
 *
 * This used to be a Zustand action that called the service directly and wrote
 * its history to an unscoped `localStorage` key, which meant the withdrawal
 * never refreshed the application/award views and the history leaked across
 * accounts on a shared browser. It is a TanStack mutation now, so the
 * `application.withdraw` row of the invalidation matrix decides which views
 * refresh, and the response lives only in the identity-scoped cache.
 */
export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (request: WithdrawalRequest) =>
      scholarshipWithdrawalService.submitWithdrawal(request),
    onSuccess: (record: WithdrawalRecord) =>
      applyScholarshipInvalidation(queryClient, keys, 'application.withdraw', {
        applicationId: record.applicationId,
        programId: record.programId,
      }),
  });
}
