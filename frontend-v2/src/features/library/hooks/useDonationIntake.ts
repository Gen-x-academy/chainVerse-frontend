'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { libraryService } from '../services/library.service';
import type { DonationIntakePayload } from '../types/library.types';

export const donationKeys = {
  all: ['library', 'donations'] as const,
  matches: (query: { isbn?: string; title?: string; author?: string }) =>
    [...donationKeys.all, 'matches', query] as const,
};

export function useCatalogMatches(
  query: { isbn?: string; title?: string; author?: string },
  enabled = false
) {
  return useQuery({
    queryKey: donationKeys.matches(query),
    queryFn: () => libraryService.searchCatalogMatches(query),
    enabled: enabled && Boolean(query.isbn || query.title),
    staleTime: 30_000,
  });
}

export function useSubmitDonationIntake() {
  return useMutation({
    mutationFn: (payload: DonationIntakePayload) => libraryService.submitDonationIntake(payload),
  });
}
