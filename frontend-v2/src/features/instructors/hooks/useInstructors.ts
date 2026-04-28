'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorService } from '../services/instructor.service';
import type { InstructorPayload } from '../types/instructor.types';

// ─── Query key factory ────────────────────────────────────────────────────────
export const instructorKeys = {
  all: ['instructors'] as const,
  lists: () => [...instructorKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) =>
    [...instructorKeys.lists(), { page, pageSize }] as const,
  details: () => [...instructorKeys.all, 'detail'] as const,
  detail: (id: string) => [...instructorKeys.details(), id] as const,
};

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useInstructorList(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: instructorKeys.list(page, pageSize),
    queryFn: () => instructorService.list(page, pageSize),
  });
}

export function useInstructorById(id: string) {
  return useQuery({
    queryKey: instructorKeys.detail(id),
    queryFn: () => instructorService.getById(id),
    enabled: Boolean(id),
  });
}

// ─── Write hooks ──────────────────────────────────────────────────────────────

export function useCreateInstructor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: InstructorPayload) => instructorService.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: instructorKeys.lists() }),
  });
}

export function useUpdateInstructor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InstructorPayload> }) =>
      instructorService.update(id, payload),
    onSuccess: (_data, { id }) => {
      client.invalidateQueries({ queryKey: instructorKeys.detail(id) });
      client.invalidateQueries({ queryKey: instructorKeys.lists() });
    },
  });
}

export function useRemoveInstructor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instructorService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: instructorKeys.lists() }),
  });
}
