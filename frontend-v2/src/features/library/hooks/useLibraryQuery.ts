'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogService } from '../services/catalog.service';
import type { CatalogSearchParams } from '../types/catalog.types';

export const catalogKeys = {
  all: ['library', 'catalog'] as const,
  search: (params: CatalogSearchParams) => [...catalogKeys.all, 'search', params] as const,
};

/**
 * Cursor-aware catalog query with request cancellation and stale-result guard.
 * Rapid filter changes abort in-flight requests via React Query's signal.
 */
export function useLibraryQuery(params: CatalogSearchParams) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const query = useQuery({
    queryKey: catalogKeys.search(params),
    queryFn: ({ signal }) => catalogService.search(paramsRef.current, signal),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return query;
}

export interface CursorPaginationState {
  cursor: string | null;
  history: string[];
}

export function useCursorPagination() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const goNext = useCallback((nextCursor: string | null) => {
    if (!nextCursor) return;
    setHistory((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
  }, [cursor]);

  const goPrev = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previous = next.pop() ?? null;
      setCursor(previous || null);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setCursor(null);
    setHistory([]);
  }, []);

  return { cursor, goNext, goPrev, reset, canGoBack: history.length > 0 };
}

/**
 * Combines filter state with cursor pagination. Resets cursor when filters change
 * so stale pages never appear after a new search.
 */
export function useLibraryCatalogSearch(
  initialParams: Omit<CatalogSearchParams, 'cursor'> = {}
) {
  const [query, setQuery] = useState(initialParams.query ?? '');
  const [facets, setFacets] = useState<Record<string, string[]>>(
    initialParams.facets ?? {}
  );
  const { cursor, goNext, goPrev, reset, canGoBack } = useCursorPagination();
  const prevFiltersRef = useRef({ query, facets });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.query !== query || JSON.stringify(prev.facets) !== JSON.stringify(facets)) {
      reset();
      prevFiltersRef.current = { query, facets };
    }
  }, [query, facets, reset]);

  const searchParams: CatalogSearchParams = {
    query: query || undefined,
    facets: Object.keys(facets).length ? facets : undefined,
    cursor,
    limit: initialParams.limit ?? 24,
    includeArchived: initialParams.includeArchived,
  };

  const result = useLibraryQuery(searchParams);

  return {
    query,
    setQuery,
    facets,
    setFacets,
    cursor,
    goNext: () => goNext(result.data?.nextCursor ?? null),
    goPrev,
    canGoBack,
    canGoNext: Boolean(result.data?.nextCursor),
    ...result,
  };
}
