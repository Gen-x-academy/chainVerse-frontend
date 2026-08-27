'use client';

import { useQuery } from '@tanstack/react-query';
import { authorService } from '../services/author.service';

export const authorKeys = {
  all: ['library', 'authors'] as const,
  details: () => [...authorKeys.all, 'detail'] as const,
  detail: (id: string) => [...authorKeys.details(), id] as const,
  books: (id: string, page: number, limit: number) =>
    [...authorKeys.detail(id), 'books', { page, limit }] as const,
  search: (query: string, page: number) =>
    [...authorKeys.all, 'search', { query, page }] as const,
};

export function useAuthor(id: string) {
  return useQuery({
    queryKey: authorKeys.detail(id),
    queryFn: () => authorService.getAuthor(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuthorBooks(id: string, page = 1, limit = 12) {
  return useQuery({
    queryKey: authorKeys.books(id, page, limit),
    queryFn: () => authorService.getAuthorBooks(id, page, limit),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAuthorSearch(query: string, page = 1) {
  return useQuery({
    queryKey: authorKeys.search(query, page),
    queryFn: () => authorService.searchAuthors(query, page),
    enabled: query.trim().length >= 2,
    staleTime: 60 * 1000,
  });
}
