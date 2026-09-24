import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { CatalogFacet, CatalogSearchResponse } from '../../types/catalog.types';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => '/catalog',
}));

vi.mock('../../services/catalog.service', () => ({
  catalogService: { search: vi.fn() },
}));

import { useCatalogFacets } from '../useCatalogFacets';
import { catalogService } from '../../services/catalog.service';
import { LibraryApiError } from '../../services/library-api';

function emptyResponse(facets?: CatalogFacet[]): CatalogSearchResponse {
  return { data: [], nextCursor: null, prevCursor: null, total: 0, facets };
}

const formatFacet = (count: number): CatalogFacet[] => [
  {
    key: 'format',
    label: 'Format',
    options: [{ value: 'print', label: 'Print', count }],
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useCatalogFacets', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams();
    vi.mocked(catalogService.search).mockReset();
    vi.mocked(catalogService.search).mockResolvedValue(emptyResponse());
  });

  it('loads facet values and counts from the catalog response', async () => {
    vi.mocked(catalogService.search).mockResolvedValue(emptyResponse(formatFacet(7)));

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });

    await waitFor(() => expect(result.current.facets[0]?.options[0]?.count).toBe(7));
    expect(result.current.facets).toEqual(formatFacet(7));
  });

  it('updates counts when the search query changes', async () => {
    vi.mocked(catalogService.search)
      .mockResolvedValueOnce(emptyResponse(formatFacet(7)))
      .mockResolvedValueOnce(emptyResponse(formatFacet(3)));

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });
    await waitFor(() => expect(result.current.facets[0]?.options[0]?.count).toBe(7));

    act(() => result.current.setQuery('dune'));

    await waitFor(() => expect(result.current.facets[0]?.options[0]?.count).toBe(3));
  });

  it('keeps selected facets removable once their count reaches zero', async () => {
    mocks.params = new URLSearchParams('facet[format]=audiobook');
    vi.mocked(catalogService.search).mockResolvedValue(emptyResponse(formatFacet(2)));

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.facets[0].options).toContainEqual({
      value: 'audiobook',
      label: 'Audiobook',
      count: 0,
    });
  });

  it('synchronizes selected facets with the URL while preserving other params', () => {
    mocks.params = new URLSearchParams('q=dune');

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });
    act(() => result.current.setFacets({ format: ['print'], genre: ['fiction'] }));

    expect(mocks.replace).toHaveBeenCalledWith(
      '/catalog?q=dune&facet%5Bformat%5D=print&facet%5Bgenre%5D=fiction',
      { scroll: false }
    );
  });

  it('clears stale facet params from the URL', () => {
    mocks.params = new URLSearchParams('q=dune&facet[format]=print');

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });
    act(() => result.current.setFacets({ format: ['ebook'] }));

    expect(mocks.replace).toHaveBeenCalledWith('/catalog?q=dune&facet%5Bformat%5D=ebook', {
      scroll: false,
    });
  });

  it('surfaces authorization failures without dropping selected facets', async () => {
    mocks.params = new URLSearchParams('facet[format]=print');
    vi.mocked(catalogService.search).mockRejectedValue(new LibraryApiError('Forbidden', 403));

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as LibraryApiError)?.statusCode).toBe(403);
    expect(result.current.facets[0].options).toContainEqual({
      value: 'print',
      label: 'Print',
      count: 0,
    });
  });

  it('handles generic failures without throwing', async () => {
    vi.mocked(catalogService.search).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCatalogFacets({ limit: 24 }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.facets).toEqual([]);
  });
});
