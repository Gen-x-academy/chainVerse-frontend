'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configurableFormService } from './service';
import type {  CreateDraftSchemaPayload,
  ForkSchemaPayload,
  UpdateDraftSchemaPayload,
} from './types';
import { useScholarshipKeys } from '../../lib/useScholarshipKeys';

export function useFormSchema(id: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.formSchemas.detail(id),
    queryFn: ({ signal }) => configurableFormService.getSchema(id, signal),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useRoundFormSchemas(roundId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.formSchemas.at('round', roundId),
    queryFn: ({ signal }) => configurableFormService.listRoundSchemas(roundId, signal),
    enabled: Boolean(roundId),
    staleTime: 30 * 1000,
  });
}

export function usePublishFormSchema() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actor }: { id: string; actor: string }) =>
      configurableFormService.publishSchema(id, actor),
    onSuccess: (published) => {
      queryClient.invalidateQueries({ queryKey: keys.formSchemas.detail(published.id) });
      queryClient.invalidateQueries({ queryKey: keys.formSchemas.at('round', published.roundId) });
    },
  });
}

export function useForkFormSchema() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ForkSchemaPayload }) =>
      configurableFormService.forkSchema(id, payload),
    onSuccess: (forked) => {
      queryClient.invalidateQueries({ queryKey: keys.formSchemas.at('round', forked.roundId) });
    },
  });
}

export function useUpdateDraftSchema() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDraftSchemaPayload }) =>
      configurableFormService.updateDraftSchema(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: keys.formSchemas.detail(updated.id) });
    },
  });
}
