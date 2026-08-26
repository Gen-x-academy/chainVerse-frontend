'use client';

import { useQuery } from '@tanstack/react-query';
import { authorService } from '../services/author.service';

export function useAuthor(id: string) {
  return useQuery({
    queryKey: ['author', id],
    queryFn: () => authorService.getAuthor(id),
    enabled: !!id,
  });
}

export function useAuthorBooks(id: string) {
  return useQuery({
    queryKey: ['author', id, 'books'],
    queryFn: () => authorService.getAuthorBooks(id),
    enabled: !!id,
  });
}
