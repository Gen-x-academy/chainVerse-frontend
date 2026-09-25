'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programScopingService } from './service';
import type {
  CreateProgramScopePayload,
  ProgramScopeTarget,
  ScopeQueryParams,
  StudentScopeApplicationContext,
  UpdateProgramScopePayload,
} from './types';

export const scopingQueryKeys = {
  all: ['scholarship-scopes'] as const,
  list: (query?: ScopeQueryParams) => [...scopingQueryKeys.all, 'list', query ?? {}] as const,
  detail: (id: string) => [...scopingQueryKeys.all, 'detail', id] as const,
  reference: () => [...scopingQueryKeys.all, 'reference'] as const,
  eligibility: (scopeId: string, studentId?: string) =>
    [...scopingQueryKeys.all, 'eligibility', scopeId, studentId ?? 'anon'] as const,
};

/**
 * Hook to query program scopes with filter criteria.
 */
export function useProgramScopes(query?: ScopeQueryParams) {
  return useQuery({
    queryKey: scopingQueryKeys.list(query),
    queryFn: ({ signal }) => programScopingService.listScopes(query, signal),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single scope by ID.
 */
export function useProgramScope(id: string) {
  return useQuery({
    queryKey: scopingQueryKeys.detail(id),
    queryFn: ({ signal }) => programScopingService.getScope(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch scoping reference data (cohorts, terms, courses, institutions, regions).
 */
export function useScopingReferenceData() {
  return useQuery({
    queryKey: scopingQueryKeys.reference(),
    queryFn: ({ signal }) => programScopingService.getReferenceData(signal),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to validate if an application can be accepted for a given scope.
 * Inactive scopes return canAccept: false.
 */
export function useScopeApplicationEligibility(
  scopeId: string,
  studentContext?: StudentScopeApplicationContext
) {
  return useQuery({
    queryKey: scopingQueryKeys.eligibility(scopeId, studentContext?.studentId),
    queryFn: () => programScopingService.evaluateApplicationEligibility(scopeId, studentContext),
    enabled: Boolean(scopeId),
    staleTime: 10 * 1000,
  });
}

/**
 * Mutation to create a program scope.
 */
export function useCreateProgramScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProgramScopePayload) =>
      programScopingService.createScope(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scopingQueryKeys.all });
    },
  });
}

/**
 * Mutation to update a program scope.
 */
export function useUpdateProgramScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProgramScopePayload }) =>
      programScopingService.updateScope(id, updates),
    onSuccess: (data: ProgramScopeTarget) => {
      queryClient.invalidateQueries({ queryKey: scopingQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: scopingQueryKeys.detail(data.id) });
    },
  });
}

/**
 * Mutation to delete a program scope.
 */
export function useDeleteProgramScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => programScopingService.deleteScope(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scopingQueryKeys.all });
    },
  });
}
