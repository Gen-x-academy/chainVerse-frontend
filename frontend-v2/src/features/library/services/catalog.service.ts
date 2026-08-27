import { libraryFetch } from './library-api';
import type { CatalogSearchParams, CatalogSearchResponse } from '../types/catalog.types';

function buildSearchQuery(params: CatalogSearchParams): string {
  const qs = new URLSearchParams();
  if (params.query) qs.set('q', params.query);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.includeArchived) qs.set('includeArchived', 'true');
  if (params.facets) {
    for (const [key, values] of Object.entries(params.facets)) {
      for (const value of values) qs.append(`facet[${key}]`, value);
    }
  }
  return qs.toString();
}

export const catalogService = {
  search: (params: CatalogSearchParams, signal?: AbortSignal) => {
    const query = buildSearchQuery(params);
    return libraryFetch<CatalogSearchResponse>(`/library/catalog/search?${query}`, { signal });
  },
};
