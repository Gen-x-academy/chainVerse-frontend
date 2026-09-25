"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scholarshipService } from '../services/scholarship.service';
import { disbursementScheduleService } from '../milestones/service';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scholarshipService } from "../services/scholarship.service";
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
} from "../types/scholarship.types";

export const scholarshipKeys = {
  all: ["scholarships"] as const,
  programs: () => [...scholarshipKeys.all, "programs"] as const,
  rounds: () => [...scholarshipKeys.all, "rounds"] as const,
  applications: (params?: ScholarshipApplicationListParams) =>
    [...scholarshipKeys.all, 'applications', params ?? {}] as const,
  awards: () => [...scholarshipKeys.all, 'awards'] as const,
  award: (id: string) => [...scholarshipKeys.all, 'award', id] as const,
  agreement: (awardId: string) => [...scholarshipKeys.all, 'agreement', awardId] as const,
  disbursements: () => [...scholarshipKeys.all, 'disbursements'] as const,
  schedule: (awardId: string) => [...scholarshipKeys.all, 'schedule', awardId] as const,
    [...scholarshipKeys.all, "applications", params ?? {}] as const,
  awards: () => [...scholarshipKeys.all, "awards"] as const,
  disbursements: () => [...scholarshipKeys.all, "disbursements"] as const,
};

export function useScholarshipPrograms() {
  return useQuery({
    queryKey: scholarshipKeys.programs(),
    queryFn: ({ signal }) => scholarshipService.getPrograms(signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useScholarshipRounds() {
  return useQuery({
    queryKey: scholarshipKeys.rounds(),
    queryFn: ({ signal }) => scholarshipService.getRounds(signal),
    staleTime: 30 * 1000,
  });
}

export function useScholarshipApplications(
  params?: ScholarshipApplicationListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: scholarshipKeys.applications(params),
    queryFn: ({ signal }) =>
      scholarshipService.listApplications(params, signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useScholarshipAwards(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: scholarshipKeys.awards(),
    queryFn: ({ signal }) => scholarshipService.getAwards(signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useScholarshipDisbursements(
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: scholarshipKeys.disbursements(),
    queryFn: ({ signal }) => scholarshipService.getDisbursements(signal),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useCreateScholarshipApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScholarshipApplicationPayload) =>
      scholarshipService.createApplication(payload),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.applications() });
      client.invalidateQueries({
        queryKey: scholarshipKeys.applications({ studentId: data.studentId }),
      });
    },
  });
}

// Issue #1112 — Award records and acceptance deadlines
export function useCreateAward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAwardPayload) => scholarshipService.createAward(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: scholarshipKeys.awards() });
    },
  });
}

export function useAwardRecord(awardId: string) {
  return useQuery({
    queryKey: scholarshipKeys.award(awardId),
    queryFn: ({ signal }) => scholarshipService.getAward(awardId, signal),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

// Issue #1113 — Signed award agreement acceptance
export function useAwardAgreement(awardId: string) {
  return useQuery({
    queryKey: scholarshipKeys.agreement(awardId),
    queryFn: ({ signal }) => scholarshipService.getAgreement(awardId, signal),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

export function useAcceptAward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: AcceptAwardPayload) => scholarshipService.acceptAward(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.awards() });
      client.invalidateQueries({ queryKey: scholarshipKeys.award(variables.awardId) });
      client.invalidateQueries({ queryKey: scholarshipKeys.agreement(variables.awardId) });
    },
  });
}

export function useDeclineAward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeclineAwardPayload) => scholarshipService.declineAward(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.awards() });
      client.invalidateQueries({ queryKey: scholarshipKeys.award(variables.awardId) });
      client.invalidateQueries({ queryKey: scholarshipKeys.agreement(variables.awardId) });
    },
  });
}

// Issue #1114 — Award cancellation and termination
export function useCancelAward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CancelAwardPayload) => scholarshipService.cancelAward(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.awards() });
      client.invalidateQueries({ queryKey: scholarshipKeys.award(variables.awardId) });
    },
  });
}

export function useTerminateAward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: TerminateAwardPayload) => scholarshipService.terminateAward(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.awards() });
      client.invalidateQueries({ queryKey: scholarshipKeys.award(variables.awardId) });
    },
  });
}

// Issue #1115 — Milestone-based disbursement schedules
export function useDisbursementSchedule(awardId: string) {
  return useQuery({
    queryKey: scholarshipKeys.schedule(awardId),
    queryFn: () => disbursementScheduleService.getByAward(awardId),
    staleTime: 30 * 1000,
    enabled: Boolean(awardId),
  });
}

export function useCreateDisbursementSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSchedulePayload) => disbursementScheduleService.create(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.schedule(variables.awardId) });
    },
  });
}

export function useAmendDisbursementSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: AmendSchedulePayload & { awardId: string }) =>
      disbursementScheduleService.amend(payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: scholarshipKeys.schedule(variables.awardId) });
    },
  });
}
