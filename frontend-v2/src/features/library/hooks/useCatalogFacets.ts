'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLibraryCatalogSearch } from './useLibraryQuery';
import {
  FACET_PARAM_PREFIX,
  adaptFacets,
  appendFacetParams,
  parseFacetsFromParams,
} from '../utils/facetAdapter';
import type { CatalogSearchParams } from '../types/catalog.types';

/**
 * Single entry point for catalog search + facets used by every catalog view.
 *
 * - Facet values and counts come from the React Query catalog response.
 * - Selected facets are synchronized with the URL so filtered views are
 *   shareable and survive reloads / back-forward navigation.
 * - Selected values are merged back into the facet list with `count: 0` when
 *   the backend omits them, keeping them removable.
 */
export function useCatalogFacets(
  initialParams: Omit<CatalogSearchParams, 'facets' | 'cursor'> = {}
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedFacets = useMemo(() => parseFacetsFromParams(searchParams), [searchParams]);

  const search = useLibraryCatalogSearch({ ...initialParams, facets: selectedFacets });

  const setFacets = useCallback(
    (next: Record<string, string[]>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of Array.from(params.keys())) {
        if (key.startsWith(FACET_PARAM_PREFIX)) params.delete(key);
      }
      appendFacetParams(params, next);

      const queryString = params.toString();
      const href = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(href, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const facets = useMemo(
    () => adaptFacets(search.data?.facets, selectedFacets),
    [search.data?.facets, selectedFacets]
  );

  return {
    ...search,
    facets,
    selectedFacets,
    setFacets,
  };
}
