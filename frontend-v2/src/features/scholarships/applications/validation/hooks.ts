'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationValidationService } from './service';
import type {  ApplicationAnswersMap,
  SubmitAnswersPayload,
} from './types';
import { useScholarshipKeys } from '../../lib/useScholarshipKeys';


export function useApplicationFormSchema(roundId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.validation.at('schema', roundId),
    queryFn: ({ signal }) => applicationValidationService.getFormSchema(roundId, signal),
    enabled: Boolean(roundId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useValidateApplicationAnswers(roundId: string) {
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (answers: ApplicationAnswersMap) =>
      applicationValidationService.validateAnswers(roundId, answers),
  });
}

export function useSubmitApplicationAnswers() {
  const keys = useScholarshipKeys();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitAnswersPayload) =>
      applicationValidationService.submitAnswers(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.validation.at('schema', variables.roundId),
      });
    },
  });
}
