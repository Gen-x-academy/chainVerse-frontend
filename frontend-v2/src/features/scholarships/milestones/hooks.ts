'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  disbursementScheduleService,
  milestoneEvidenceService,
  milestoneVerifierService,
} from './service';
import { applyScholarshipInvalidation } from '../lib/invalidation';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';
import type {
  MilestoneEvidence,
  RecordDecisionPayload,
  SubmitEvidencePayload,
  VerifierDecision,
} from './types';

/** Every evidence version attached to a milestone. */
export function useMilestoneEvidenceList(milestoneId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.milestones.list({ milestoneId }),
    queryFn: () => milestoneEvidenceService.getByMilestone(milestoneId),
    enabled: Boolean(milestoneId),
  });
}

export function useMilestoneEvidence(evidenceId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.milestones.detail(evidenceId),
    queryFn: () => milestoneEvidenceService.getById(evidenceId),
    enabled: Boolean(evidenceId),
  });
}

export function useMilestoneDecisions(evidenceId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.milestones.at('decisions', evidenceId),
    queryFn: () => milestoneVerifierService.getDecisions(evidenceId),
    enabled: Boolean(evidenceId),
  });
}

/**
 * Submit milestone evidence (#1227).
 *
 * A new version changes the content hash the verifier sees, so the evidence
 * queries for that milestone are stale immediately.
 */
export function useSubmitMilestoneEvidence() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (payload: SubmitEvidencePayload) => milestoneEvidenceService.submit(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.milestones.all });
      if (variables.milestoneId) {
        queryClient.invalidateQueries({
          queryKey: keys.milestones.list({ milestoneId: variables.milestoneId }),
        });
      }
    },
  });
}

/**
 * Record a verifier decision (#1227).
 *
 * `awardId` is passed in rather than read off the response: `VerifierDecision`
 * does not carry it, but the award is what owns the disbursement schedule the
 * decision advances. Without it the row can only widen to the schedule
 * *collection*, which refetches every award's schedule on the page.
 *
 * A conflict-of-interest rejection is not a state change worth fanning out
 * over, so `onError` only surfaces the failure; the decision list is refetched
 * because a rejected write may still have been recorded server-side.
 */
export function useRecordMilestoneDecision(options: { awardId?: string } = {}) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (payload: RecordDecisionPayload) =>
      milestoneVerifierService.recordDecision(payload),
    onSuccess: async (_decision: VerifierDecision, variables: RecordDecisionPayload) => {
      queryClient.invalidateQueries({
        queryKey: keys.milestones.at('decisions', variables.evidenceId),
      });
      await applyScholarshipInvalidation(queryClient, keys, 'milestone.verify', {
        awardId: options.awardId,
      });
    },
    onError: (_error, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.milestones.at('decisions', variables.evidenceId),
      });
    },
  });
}

export function useActivateDisbursementSchedule() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();

  return useMutation({
    mutationFn: (scheduleId: string) => disbursementScheduleService.activate(scheduleId),
    onSuccess: (schedule) =>
      applyScholarshipInvalidation(queryClient, keys, 'milestone.schedule.create', {
        awardId: schedule.awardId,
      }),
  });
}

/** Re-exported so panels can type a conflict check without a deep import. */
export type { MilestoneEvidence };
