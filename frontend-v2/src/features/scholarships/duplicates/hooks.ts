'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationDuplicateService } from './service';
import type { MergeApplicationsPayload } from './types';

export const duplicateQueryKeys = {
  all: ['duplicate-applications'] as const,
  check: (studentId: string, programId: string, roundId: string) =>
    [...duplicateQueryKeys.all, 'check', studentId, programId, roundId] as const,
  clusters: () => [...duplicateQueryKeys.all, 'clusters'] as const,
  cluster: (id: string) => [...duplicateQueryKeys.all, 'cluster', id] as const,
  mergeAudits: () => [...duplicateQueryKeys.all, 'merge-audits'] as const,
};

/**
 * Hook to check applicant uniqueness before application creation.
 */
export function useApplicantUniquenessCheck(
  studentId: string,
  programId: string,
  roundId: string
) {
  return useQuery({
    queryKey: duplicateQueryKeys.check(studentId, programId, roundId),
    queryFn: () => applicationDuplicateService.checkUniqueness(studentId, programId, roundId),
    enabled: Boolean(studentId) && Boolean(programId) && Boolean(roundId),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to retrieve duplicate application clusters for administrator review.
 */
export function useDuplicateClusters() {
  return useQuery({
    queryKey: duplicateQueryKeys.clusters(),
    queryFn: () => applicationDuplicateService.listDuplicateClusters(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single duplicate cluster by ID.
 */
export function useDuplicateCluster(clusterId: string) {
  return useQuery({
    queryKey: duplicateQueryKeys.cluster(clusterId),
    queryFn: () => applicationDuplicateService.getCluster(clusterId),
    enabled: Boolean(clusterId),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook to execute a controlled administrative merge.
 */
export function useMergeApplications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MergeApplicationsPayload) =>
      applicationDuplicateService.mergeApplications(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: duplicateQueryKeys.all });
    },
  });
}

/**
 * Hook to fetch audit records of merged applications.
 */
export function useMergeAuditHistory() {
  return useQuery({
    queryKey: duplicateQueryKeys.mergeAudits(),
    queryFn: () => applicationDuplicateService.getMergeAuditHistory(),
    staleTime: 30 * 1000,
  });
}
