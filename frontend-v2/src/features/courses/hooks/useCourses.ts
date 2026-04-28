'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/course.service';
import type { CoursePayload } from '../types';

// ─── Query key factory ────────────────────────────────────────────────────────
// Centralised per-feature; enables precise cache invalidation.
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) =>
    [...courseKeys.lists(), { page, pageSize }] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: string) => [...courseKeys.details(), id] as const,
};

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useCourseList(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: courseKeys.list(page, pageSize),
    queryFn: () => courseService.list(page, pageSize),
  });
}

export function useCourseById(id: string) {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: () => courseService.getById(id),
    enabled: Boolean(id),
  });
}

// ─── Write hooks ──────────────────────────────────────────────────────────────

export function useCreateCourse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CoursePayload) => courseService.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: courseKeys.lists() }),
  });
}

export function useUpdateCourse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CoursePayload> }) =>
      courseService.update(id, payload),
    onSuccess: (_data, { id }) => {
      client.invalidateQueries({ queryKey: courseKeys.detail(id) });
      client.invalidateQueries({ queryKey: courseKeys.lists() });
    },
  });
}

export function useRemoveCourse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => courseService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: courseKeys.lists() }),
  });
}
