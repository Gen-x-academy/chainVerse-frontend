'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryService } from '../services/library.service';
import type { LocationSelection } from '../types/library.types';

export const locationKeys = {
  all: ['library', 'locations'] as const,
  tree: () => [...locationKeys.all, 'tree'] as const,
  validate: (selection: LocationSelection) => [...locationKeys.all, 'validate', selection] as const,
};

export function useLocationTree() {
  return useQuery({
    queryKey: locationKeys.tree(),
    queryFn: () => libraryService.getLocationTree(),
    staleTime: 5 * 60_000,
  });
}
