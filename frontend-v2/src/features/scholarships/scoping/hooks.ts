'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programScopingService } from './service';
import type {  CreateProgramScopePayload,
  ProgramScopeTarget,
  ScopeQueryParams,
  StudentScopeApplicationContext,
  UpdateProgramScopePayload,
} from './types';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';


/**
 * Hook to query program scopes with filter criteria.
 */
export function useProgramScopes(query?: ScopeQueryParams) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.scopes.list(query),
    queryFn: ({ signal }) => programScopingService.listScopes(query, signal),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single scope by ID.
 */
export function useProgramScope(id: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.scopes.detail(id),
    queryFn: ({ signal }) => programScopingService.getScope(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch scoping reference data (cohorts, terms, courses, institutions, regions).
 */
export function useScopingReferenceData() {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.scopes.at('reference'),
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
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.scopes.at('eligibility', scopeId, studentContext?.studentId ?? 'anon'),
    queryFn: () => programScopingService.evaluateApplicationEligibility(scopeId, studentContext),
    enabled: Boolean(scopeId),
    staleTime: 10 * 1000,
  });
}

/**
 * Mutation to create a program scope.
 */
export function useCreateProgramScope() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProgramScopePayload) =>
      programScopingService.createScope(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.scopes.all });
    },
  });
}

/**
 * Mutation to update a program scope.
 */
export function useUpdateProgramScope() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProgramScopePayload }) =>
      programScopingService.updateScope(id, updates),
    onSuccess: (data: ProgramScopeTarget) => {
      queryClient.invalidateQueries({ queryKey: keys.scopes.all });
      queryClient.invalidateQueries({ queryKey: keys.scopes.detail(data.id) });
    },
  });
}

/**
 * Mutation to delete a program scope.
 */
export function useDeleteProgramScope() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => programScopingService.deleteScope(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.scopes.all });
    },
  });
}
