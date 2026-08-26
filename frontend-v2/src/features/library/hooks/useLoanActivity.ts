'use client';

import { useQuery } from '@tanstack/react-query';
import { loanService } from '../services/loan.service';

export const loanKeys = {
  all: ['library', 'loans'] as const,
  activity: (patronId?: string) => [...loanKeys.all, 'activity', patronId ?? 'self'] as const,
};

export function useLoanActivity(patronId?: string) {
  return useQuery({
    queryKey: loanKeys.activity(patronId),
    queryFn: ({ signal }) => loanService.getActivity(patronId, signal),
    staleTime: 30 * 1000,
  });
}
