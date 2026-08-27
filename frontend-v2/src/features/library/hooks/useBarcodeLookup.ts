'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { libraryService } from '../services/library.service';
import type { ScanMode } from '../types/library.types';

export const circulationKeys = {
  all: ['library', 'circulation'] as const,
  copy: (barcode: string) => [...circulationKeys.all, 'copy', barcode] as const,
};

export function useBarcodeLookup(barcode: string, enabled = false) {
  return useQuery({
    queryKey: circulationKeys.copy(barcode),
    queryFn: () => libraryService.lookupByBarcode(barcode),
    enabled: enabled && barcode.length >= 8,
    retry: false,
  });
}

export function useCirculationScan() {
  return useMutation({
    mutationFn: ({ mode, barcode }: { mode: ScanMode; barcode: string }) =>
      libraryService.recordScan(mode, barcode),
  });
}

export function useCheckoutCopy() {
  return useMutation({
    mutationFn: ({ copyId, patronId }: { copyId: string; patronId: string }) =>
      libraryService.checkoutCopy(copyId, patronId),
  });
}

export function useReturnCopy() {
  return useMutation({
    mutationFn: (copyId: string) => libraryService.returnCopy(copyId),
  });
}
