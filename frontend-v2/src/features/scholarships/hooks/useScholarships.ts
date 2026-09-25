"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scholarshipService } from "../services/scholarship.service";
import type {
  CreateScholarshipApplicationPayload,
  ScholarshipApplicationListParams,
} from "../types/scholarship.types";

export const scholarshipKeys = {
  all: ["scholarships"] as const,
  programs: () => [...scholarshipKeys.all, "programs"] as const,
  rounds: () => [...scholarshipKeys.all, "rounds"] as const,
  applications: (params?: ScholarshipApplicationListParams) =>
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
