'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { libraryService } from '../services/library.service';
import type { LocationSelection } from '../types/library.types';

export const stocktakeKeys = {
  all: ['library', 'stocktake'] as const,
  current: () => [...stocktakeKeys.all, 'current'] as const,
  session: (id: string) => [...stocktakeKeys.all, 'session', id] as const,
};

export function useCurrentStocktakeSession() {
  return useQuery({
    queryKey: stocktakeKeys.current(),
    queryFn: () => libraryService.getCurrentStocktakeSession(),
    staleTime: 0,
    retry: false,
  });
}

export function useStocktakeSession(sessionId: string | null) {
  return useQuery({
    queryKey: stocktakeKeys.session(sessionId ?? ''),
    queryFn: () => libraryService.getStocktakeSession(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 30_000,
  });
}

export function useStartStocktake() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (location: LocationSelection) => libraryService.startStocktake(location),
    onSuccess: (session) => {
      client.setQueryData(stocktakeKeys.session(session.id), session);
    },
  });
}

export function useRecordStocktakeScan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, barcode, idempotencyKey }: { sessionId: string; barcode: string; idempotencyKey: string }) =>
      libraryService.recordStocktakeScan(sessionId, barcode, idempotencyKey),
    onSuccess: (session) => {
      client.setQueryData(stocktakeKeys.session(session.id), session);
    },
  });
}

export function useCompleteStocktake() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, discrepanciesReviewed }: { sessionId: string; discrepanciesReviewed: boolean }) =>
      libraryService.completeStocktake(sessionId, discrepanciesReviewed),
    onSuccess: (session) => {
      client.setQueryData(stocktakeKeys.session(session.id), session);
    },
  });
}
