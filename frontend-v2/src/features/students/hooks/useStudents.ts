'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../services/student.service';
import type { StudentPayload } from '../services/student.service';

// ─── Query key factory ────────────────────────────────────────────────────────
export const studentKeys = {
  all: ['students'] as const,
  lists: () => [...studentKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) =>
    [...studentKeys.lists(), { page, pageSize }] as const,
  details: () => [...studentKeys.all, 'detail'] as const,
  detail: (id: string) => [...studentKeys.details(), id] as const,
};

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useStudentList(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: studentKeys.list(page, pageSize),
    queryFn: () => studentService.list(page, pageSize),
  });
}

export function useStudentById(id: string) {
  return useQuery({
    queryKey: studentKeys.detail(id),
    queryFn: () => studentService.getById(id),
    enabled: Boolean(id),
  });
}

// ─── Write hooks ──────────────────────────────────────────────────────────────

export function useCreateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudentPayload) => studentService.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: studentKeys.lists() }),
  });
}

export function useUpdateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StudentPayload> }) =>
      studentService.update(id, payload),
    onSuccess: (_data, { id }) => {
      client.invalidateQueries({ queryKey: studentKeys.detail(id) });
      client.invalidateQueries({ queryKey: studentKeys.lists() });
    },
  });
}

export function useRemoveStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: studentKeys.lists() }),
  });
}
