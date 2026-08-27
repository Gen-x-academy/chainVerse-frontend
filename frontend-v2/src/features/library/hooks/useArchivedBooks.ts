'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveService } from '../services/archive.service';

export const archiveKeys = {
  all: ['library', 'archived'] as const,
  list: (page: number, limit: number) => [...archiveKeys.all, 'list', { page, limit }] as const,
};

export function useArchivedBooks(page = 1, limit = 20) {
  return useQuery({
    queryKey: archiveKeys.list(page, limit),
    queryFn: ({ signal }) => archiveService.listArchived(page, limit, signal),
    staleTime: 30 * 1000,
  });
}

export function useRestoreBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => archiveService.restore(bookId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: archiveKeys.all });
      client.invalidateQueries({ queryKey: ['library', 'catalog'] });
    },
  });
}
