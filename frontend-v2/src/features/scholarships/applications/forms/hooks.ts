'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configurableFormService } from './service';
import type {
  CreateDraftSchemaPayload,
  ForkSchemaPayload,
  UpdateDraftSchemaPayload,
} from './types';

export const formSchemaQueryKeys = {
  all: ['configurable-form-schemas'] as const,
  detail: (id: string) => [...formSchemaQueryKeys.all, 'detail', id] as const,
  round: (roundId: string) => [...formSchemaQueryKeys.all, 'round', roundId] as const,
};

export function useFormSchema(id: string) {
  return useQuery({
    queryKey: formSchemaQueryKeys.detail(id),
    queryFn: ({ signal }) => configurableFormService.getSchema(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useRoundFormSchemas(roundId: string) {
  return useQuery({
    queryKey: formSchemaQueryKeys.round(roundId),
    queryFn: ({ signal }) => configurableFormService.listRoundSchemas(roundId, signal),
    enabled: Boolean(roundId),
    staleTime: 30 * 1000,
  });
}

export function usePublishFormSchema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actor }: { id: string; actor: string }) =>
      configurableFormService.publishSchema(id, actor),
    onSuccess: (published) => {
      queryClient.invalidateQueries({ queryKey: formSchemaQueryKeys.detail(published.id) });
      queryClient.invalidateQueries({ queryKey: formSchemaQueryKeys.round(published.roundId) });
    },
  });
}

export function useForkFormSchema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ForkSchemaPayload }) =>
      configurableFormService.forkSchema(id, payload),
    onSuccess: (forked) => {
      queryClient.invalidateQueries({ queryKey: formSchemaQueryKeys.round(forked.roundId) });
    },
  });
}

export function useUpdateDraftSchema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDraftSchemaPayload }) =>
      configurableFormService.updateDraftSchema(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: formSchemaQueryKeys.detail(updated.id) });
    },
  });
}
