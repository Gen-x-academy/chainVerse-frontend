'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationDuplicateService } from './service';
import type { MergeApplicationsPayload } from './types';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';


/**
 * Hook to check applicant uniqueness before application creation.
 */
export function useApplicantUniquenessCheck(
  studentId: string,
  programId: string,
  roundId: string
) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.duplicates.at('check', studentId, programId, roundId),
    queryFn: () => applicationDuplicateService.checkUniqueness(studentId, programId, roundId),
    enabled: Boolean(studentId) && Boolean(programId) && Boolean(roundId),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to retrieve duplicate application clusters for administrator review.
 */
export function useDuplicateClusters() {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.duplicates.at('clusters'),
    queryFn: () => applicationDuplicateService.listDuplicateClusters(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single duplicate cluster by ID.
 */
export function useDuplicateCluster(clusterId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.duplicates.at('cluster', clusterId),
    queryFn: () => applicationDuplicateService.getCluster(clusterId),
    enabled: Boolean(clusterId),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook to execute a controlled administrative merge.
 */
export function useMergeApplications() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MergeApplicationsPayload) =>
      applicationDuplicateService.mergeApplications(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.duplicates.all });
    },
  });
}

/**
 * Hook to fetch audit records of merged applications.
 */
export function useMergeAuditHistory() {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.duplicates.at('merge-audits'),
    queryFn: () => applicationDuplicateService.getMergeAuditHistory(),
    staleTime: 30 * 1000,
  });
}
