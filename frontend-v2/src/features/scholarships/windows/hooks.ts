'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programWindowService } from './service';
import type {
  ApplicationWindow,
  CreateWindowPayload,
  UpdateWindowPayload,
  WindowQueryParams,
} from './types';

export const windowQueryKeys = {
  all: ['application-windows'] as const,
  list: (query?: WindowQueryParams) => [...windowQueryKeys.all, 'list', query ?? {}] as const,
  detail: (id: string) => [...windowQueryKeys.all, 'detail', id] as const,
  assessment: (id: string, proposedUtc: string) =>
    [...windowQueryKeys.all, 'assessment', id, proposedUtc] as const,
  timing: (id: string) => [...windowQueryKeys.all, 'timing', id] as const,
  audits: (id: string) => [...windowQueryKeys.all, 'audits', id] as const,
};

/**
 * Hook to list program application windows.
 */
export function useProgramWindows(query?: WindowQueryParams) {
  return useQuery({
    queryKey: windowQueryKeys.list(query),
    queryFn: ({ signal }) => programWindowService.listWindows(query, signal),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single window by ID.
 */
export function useProgramWindow(id: string) {
  return useQuery({
    queryKey: windowQueryKeys.detail(id),
    queryFn: ({ signal }) => programWindowService.getWindow(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to evaluate proposed deadline change impact on submitted applications.
 */
export function useDeadlineChangeAssessment(windowId: string, proposedCloseUtc?: string) {
  return useQuery({
    queryKey: windowQueryKeys.assessment(windowId, proposedCloseUtc ?? ''),
    queryFn: () => programWindowService.evaluateDeadlineChange(windowId, proposedCloseUtc!),
    enabled: Boolean(windowId) && Boolean(proposedCloseUtc),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to evaluate submission timing against window boundaries.
 */
export function useSubmissionTiming(windowId: string, waiverToken?: string) {
  return useQuery({
    queryKey: windowQueryKeys.timing(windowId),
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

  return useMutation({
    mutationFn: (payload: CreateWindowPayload) => programWindowService.createWindow(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: windowQueryKeys.all });
    },
  });
}

/**
 * Mutation hook to update an application window with grandfathering protection.
 */
export function useUpdateProgramWindow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWindowPayload }) =>
      programWindowService.updateWindow(id, updates),
    onSuccess: (data: ApplicationWindow) => {
      queryClient.invalidateQueries({ queryKey: windowQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: windowQueryKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to fetch audit log for deadline modifications.
 */
export function useDeadlineAuditHistory(windowId: string) {
  return useQuery({
    queryKey: windowQueryKeys.audits(windowId),
    queryFn: () => programWindowService.getAuditHistory(windowId),
    enabled: Boolean(windowId),
    staleTime: 15 * 1000,
  });
}
