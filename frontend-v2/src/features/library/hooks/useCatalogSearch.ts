'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLibraryQuery, useCursorPagination } from './useLibraryQuery';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import {
  FACET_PARAM_PREFIX,
  adaptFacets,
  appendFacetParams,
  parseFacetsFromParams,
} from '../utils/facetAdapter';
import type { CatalogSearchParams } from '../types/catalog.types';

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_QUERY_PARAM = 'q';

export interface UseCatalogSearchOptions
  extends Omit<CatalogSearchParams, 'query' | 'facets' | 'cursor'> {
  /** Debounce applied to the text query before it is sent to the API. */
  debounceMs?: number;
}

/**
 * Real catalog full-text search with debounced input, URL-backed query and
 * filters, cursor pagination, and React Query cancellation.
 *
 * - The query (`?q=`) and selected facets (`?facet[key]=value`) are read from
 *   and written to the URL so refresh and back/forward restore the search.
 * - React Query keys requests by the active filters and passes an AbortSignal,
 *   so superseded requests are cancelled and can never overwrite newer results.
 * - Autocomplete suggestions are derived from the live result set.
 */
export function useCatalogSearch(options: UseCatalogSearchOptions = {}) {
  const { debounceMs = SEARCH_DEBOUNCE_MS, limit = 24, includeArchived } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlQuery = searchParams.get(SEARCH_QUERY_PARAM) ?? '';
  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const lastWrittenQuery = useRef(urlQuery);

  // Adopt URL changes caused by refresh, back, or forward navigation.
  useEffect(() => {
    const current = searchParams.get(SEARCH_QUERY_PARAM) ?? '';
    if (current !== lastWrittenQuery.current) {
      lastWrittenQuery.current = current;
      setQuery(current);
    }
  }, [searchParams]);

  // Persist the debounced query to the URL so it survives reload/navigation.
  useEffect(() => {
    const current = searchParams.get(SEARCH_QUERY_PARAM) ?? '';
    if (debouncedQuery === current) return;

    lastWrittenQuery.current = debouncedQuery;
    const next = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) next.set(SEARCH_QUERY_PARAM, debouncedQuery);
    else next.delete(SEARCH_QUERY_PARAM);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [debouncedQuery, searchParams, router, pathname]);

  const selectedFacets = useMemo(() => parseFacetsFromParams(searchParams), [searchParams]);

  const setFacets = useCallback(
    (next: Record<string, string[]>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of Array.from(params.keys())) {
        if (key.startsWith(FACET_PARAM_PREFIX)) params.delete(key);
      }
      appendFacetParams(params, next);

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const { cursor, goNext, goPrev, reset, canGoBack } = useCursorPagination();

  useEffect(() => {
    reset();
  }, [debouncedQuery, selectedFacets, reset]);

  const apiParams: CatalogSearchParams = {
    query: debouncedQuery || undefined,
    facets: Object.keys(selectedFacets).length ? selectedFacets : undefined,
    cursor,
    limit,
    includeArchived,
  };

  const result = useLibraryQuery(apiParams);

  const facets = useMemo(
    () => adaptFacets(result.data?.facets, selectedFacets),
    [result.data?.facets, selectedFacets]
  );

  const suggestions = useMemo(
    () => Array.from(new Set((result.data?.data ?? []).map((item) => item.title))),
    [result.data]
  );

  return {
    ...result,
    query,
    setQuery,
    debouncedQuery,
    facets,
    selectedFacets,
    setFacets,
    suggestions,
    cursor,
    canGoBack,
    canGoNext: Boolean(result.data?.nextCursor),
    goPrev,
    goNext: () => goNext(result.data?.nextCursor ?? null),
  };
}
