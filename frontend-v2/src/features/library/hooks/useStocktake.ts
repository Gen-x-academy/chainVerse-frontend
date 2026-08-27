'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { libraryService } from '../services/library.service';
import type { LocationSelection } from '../types/library.types';

export const stocktakeKeys = {
  all: ['library', 'stocktake'] as const,
  session: (id: string) => [...stocktakeKeys.all, 'session', id] as const,
};

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
    mutationFn: ({ sessionId, barcode }: { sessionId: string; barcode: string }) =>
      libraryService.recordStocktakeScan(sessionId, barcode),
    onSuccess: (session) => {
      client.setQueryData(stocktakeKeys.session(session.id), session);
    },
  });
}

export function useCompleteStocktake() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => libraryService.completeStocktake(sessionId),
    onSuccess: (session) => {
      client.setQueryData(stocktakeKeys.session(session.id), session);
    },
  });
}
