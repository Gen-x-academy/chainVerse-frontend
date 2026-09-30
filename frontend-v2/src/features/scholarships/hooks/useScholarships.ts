'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scholarshipService } from '../services/scholarship.service';
import { disbursementScheduleService } from '../milestones/service';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';
import {
  applyScholarshipInvalidation,
  type ScholarshipMutation,
} from '../lib/invalidation';
import type {
  AcceptAwardPayload,
  CancelAwardPayload,
  CreateAwardPayload,
  CreateScholarshipApplicationPayload,
  DeclineAwardPayload,
  ScholarshipApplicationListParams,
  TerminateAwardPayload,
} from '../types/scholarship.types';
import type { AmendSchedulePayload, CreateSchedulePayload } from '../milestones/types';

/**
 * Scholarship reads and the award / milestone writes that drive them.
 *
 * Keys come from the identity-scoped factory in `lib/queryKeys.ts` and every
 * write resolves its fan-out through the matrix in `lib/invalidation.ts`, so a
 * decision converges the award, application, round, budget and disbursement
 * views without a reload (#1227).
 */
export function useScholarshipPrograms() {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.programs.lists(),
    queryFn: ({ signal }) => scholarshipService.getPrograms(signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useScholarshipRounds() {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.rounds.lists(),
    queryFn: ({ signal }) => scholarshipService.getRounds(signal),
    staleTime: 30 * 1000,
  });
}

export function useScholarshipApplications(
  params?: ScholarshipApplicationListParams,
  options: { enabled?: boolean } = {},
) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.applications.list(params),
    queryFn: ({ signal }) =>
      scholarshipService.listApplications(params, signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useScholarshipAwards(options: { enabled?: boolean } = {}) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.awards.lists(),
    queryFn: ({ signal }) => scholarshipService.getAwards(signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useScholarshipDisbursements(
  options: { enabled?: boolean } = {},
) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.disbursements.lists(),
    queryFn: ({ signal }) => scholarshipService.getDisbursements(signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useCreateScholarshipApplication() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: CreateScholarshipApplicationPayload) =>
      scholarshipService.createApplication(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'application.create', {
        programId: variables.roundId,
      }),
  });
}

// Issue #1112 — Award records and acceptance deadlines
export function useCreateAward() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: CreateAwardPayload) => scholarshipService.createAward(payload),
    onSuccess: (data) =>
      applyScholarshipInvalidation(queryClient, keys, 'award.create', {
        // The response carries the new award id, so the detail view is targeted
        // precisely instead of widening to the whole collection.
        awardId: data.id,
        applicationId: data.applicationId,
      }),
  });
}

export function useAwardRecord(awardId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.awards.detail(awardId),
    queryFn: ({ signal }) => scholarshipService.getAward(awardId, signal),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

// Issue #1113 — Signed award agreement acceptance
export function useAwardAgreement(awardId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.agreements.detail(awardId),
    queryFn: ({ signal }) => scholarshipService.getAgreement(awardId, signal),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

export function useAcceptAward() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: AcceptAwardPayload) => scholarshipService.acceptAward(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'award.accept', {
        awardId: variables.awardId,
      }),
  });
}

export function useDeclineAward() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: DeclineAwardPayload) => scholarshipService.declineAward(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'award.decline', {
        awardId: variables.awardId,
      }),
  });
}

// Issue #1114 — Award cancellation and termination
export function useCancelAward() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: CancelAwardPayload) => scholarshipService.cancelAward(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'award.cancel', {
        awardId: variables.awardId,
      }),
  });
}

export function useTerminateAward() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: TerminateAwardPayload) => scholarshipService.terminateAward(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'award.terminate', {
        awardId: variables.awardId,
      }),
  });
}

// Issue #1115 — Milestone-based disbursement schedules
export function useDisbursementSchedule(awardId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.schedules.detail(awardId),
    queryFn: () => disbursementScheduleService.getByAward(awardId),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

export function useCreateDisbursementSchedule() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: CreateSchedulePayload) => disbursementScheduleService.create(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(
        queryClient,
        keys,
        'milestone.schedule.create',
        { awardId: variables.awardId },
      ),
  });
}

export function useAmendDisbursementSchedule() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: AmendSchedulePayload & { awardId: string }) =>
      disbursementScheduleService.amend(payload),
    onSuccess: (_data, variables) =>
      applyScholarshipInvalidation(queryClient, keys, 'milestone.schedule.amend', {
        awardId: variables.awardId,
      }),
  });
}

export type { ScholarshipMutation };
