'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programWindowService } from './service';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';
import { applyScholarshipInvalidation } from '../lib/invalidation';
import type {
  ApplicationWindow,
  CreateWindowPayload,
  UpdateWindowPayload,
  WindowQueryParams,
} from './types';

/**
 * Window keys live under the identity-scoped scholarship root (#1227) so a
 * deadline change can invalidate the window, round and application views
 * together. The old `['application-windows']` root was reachable from no other
 * namespace, so nothing could fan out to it.
 */

/**
 * Hook to list program application windows.
 */
export function useProgramWindows(query?: WindowQueryParams) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.windows.list(query),
    queryFn: ({ signal }) => programWindowService.listWindows(query, signal),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single window by ID.
 */
export function useProgramWindow(id: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.windows.detail(id),
    queryFn: ({ signal }) => programWindowService.getWindow(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to evaluate proposed deadline change impact on submitted applications.
 */
export function useDeadlineChangeAssessment(windowId: string, proposedCloseUtc?: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.windows.at('assessment', windowId, proposedCloseUtc ?? ''),
    queryFn: () => programWindowService.evaluateDeadlineChange(windowId, proposedCloseUtc!),
    enabled: Boolean(windowId) && Boolean(proposedCloseUtc),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to evaluate submission timing against window boundaries.
 */
export function useSubmissionTiming(windowId: string, waiverToken?: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.windows.at('timing', windowId),
    queryFn: () => programWindowService.evaluateSubmissionTiming(windowId, new Date(), waiverToken),
    enabled: Boolean(windowId),
    staleTime: 10 * 1000,
  });
}

/**
 * Mutation hook to create an application opening and deadline window.
 */
export function useCreateProgramWindow() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (payload: CreateWindowPayload) => programWindowService.createWindow(payload),
    onSuccess: () => applyScholarshipInvalidation(queryClient, keys, 'window.create'),
  });
}

/**
 * Mutation hook to update an application window with grandfathering protection.
 */
export function useUpdateProgramWindow() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWindowPayload }) =>
      programWindowService.updateWindow(id, updates),
    onSuccess: (data: ApplicationWindow) =>
      applyScholarshipInvalidation(queryClient, keys, 'window.update', {
        windowId: data.id,
      }),
  });
}

/**
 * Hook to fetch audit log for deadline modifications.
 */
export function useDeadlineAuditHistory(windowId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.windows.at('audits', windowId),
    queryFn: () => programWindowService.getAuditHistory(windowId),
    enabled: Boolean(windowId),
    staleTime: 15 * 1000,
  });
}
