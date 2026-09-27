'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationValidationService } from './service';
import type {
  ApplicationAnswersMap,
  SubmitAnswersPayload,
} from './types';

export const applicationValidationQueryKeys = {
  all: ['scholarship-application-validation'] as const,
  schema: (roundId: string) =>
    [...applicationValidationQueryKeys.all, 'schema', roundId] as const,
  validationCheck: (roundId: string, answersHash: string) =>
    [...applicationValidationQueryKeys.all, 'check', roundId, answersHash] as const,
};

export function useApplicationFormSchema(roundId: string) {
  return useQuery({
    queryKey: applicationValidationQueryKeys.schema(roundId),
    queryFn: ({ signal }) => applicationValidationService.getFormSchema(roundId, signal),
    enabled: Boolean(roundId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useValidateApplicationAnswers(roundId: string) {
  return useMutation({
    mutationFn: (answers: ApplicationAnswersMap) =>
      applicationValidationService.validateAnswers(roundId, answers),
  });
}

export function useSubmitApplicationAnswers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitAnswersPayload) =>
      applicationValidationService.submitAnswers(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: applicationValidationQueryKeys.schema(variables.roundId),
      });
    },
  });
}
