import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { CatalogSearchResponse } from '../../types/catalog.types';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => '/catalog/search',
}));

vi.mock('../../services/catalog.service', () => ({
  catalogService: { search: vi.fn() },
}));

import { useCatalogSearch } from '../useCatalogSearch';
import { catalogService } from '../../services/catalog.service';
import { LibraryApiError } from '../../services/library-api';

function response(overrides: Partial<CatalogSearchResponse> = {}): CatalogSearchResponse {
  return { data: [], nextCursor: null, prevCursor: null, total: 0, ...overrides };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

function renderSearch() {
  return renderHook(() => useCatalogSearch({ limit: 24, debounceMs: 0 }), { wrapper });
}

describe('useCatalogSearch', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams();
    vi.mocked(catalogService.search).mockReset();
    vi.mocked(catalogService.search).mockResolvedValue(response());
  });

  it('renders real results and derives suggestions from the response', async () => {
    vi.mocked(catalogService.search).mockResolvedValue(
      response({
        data: [
          { id: '1', title: 'Dune' },
          { id: '2', title: 'Dune Messiah' },
        ],
        total: 2,
      })
    );

    const { result } = renderSearch();

    await waitFor(() => expect(result.current.data?.data).toHaveLength(2));
    expect(result.current.suggestions).toEqual(['Dune', 'Dune Messiah']);
  });

  it('restores the query from the URL on load', async () => {
    mocks.params = new URLSearchParams('q=dune');

    renderSearch();

    await waitFor(() =>
      expect(catalogService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune', limit: 24 }),
        expect.anything()
      )
    );
  });

  it('debounces input and persists the query to the URL', async () => {
    const { result } = renderSearch();

    act(() => result.current.setQuery('dune'));

    await waitFor(() =>
      expect(catalogService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune' }),
        expect.anything()
      )
    );
    expect(mocks.replace).toHaveBeenCalledWith('/catalog/search?q=dune', { scroll: false });
  });

  it('reads facet filters from the URL and writes selections back', async () => {
    mocks.params = new URLSearchParams('q=dune&facet[format]=print');

    const { result } = renderSearch();
    await waitFor(() =>
      expect(catalogService.search).toHaveBeenCalledWith(
        expect.objectContaining({ facets: { format: ['print'] } }),
        expect.anything()
      )
    );

    act(() => result.current.setFacets({ format: ['ebook'] }));
    expect(mocks.replace).toHaveBeenCalledWith('/catalog/search?q=dune&facet%5Bformat%5D=ebook', {
      scroll: false,
    });
  });

  it('passes an AbortSignal so superseded requests can be cancelled', async () => {
    renderSearch();

    await waitFor(() => expect(catalogService.search).toHaveBeenCalled());
    const [, signal] = vi.mocked(catalogService.search).mock.calls[0];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('does not let a stale response overwrite newer results', async () => {
    mocks.params = new URLSearchParams('q=alpha');
    const first = deferred<CatalogSearchResponse>();
    const second = deferred<CatalogSearchResponse>();

    vi.mocked(catalogService.search).mockImplementation((params) =>
      params.query === 'alpha' ? first.promise : second.promise
    );

    const { result } = renderSearch();
    await waitFor(() => expect(catalogService.search).toHaveBeenCalledTimes(1));

    act(() => result.current.setQuery('beta'));
    await waitFor(() => expect(catalogService.search).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve(response({ data: [{ id: 'b', title: 'Beta' }], total: 1 }));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data?.data?.[0]?.title).toBe('Beta'));

    await act(async () => {
      first.resolve(response({ data: [{ id: 'a', title: 'Alpha' }], total: 1 }));
      await Promise.resolve();
    });

    expect(result.current.data?.data?.[0]?.title).toBe('Beta');
  });

  it('surfaces generic failures', async () => {
    vi.mocked(catalogService.search).mockRejectedValue(new Error('network down'));

    const { result } = renderSearch();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('surfaces authorization failures with the API status code', async () => {
    vi.mocked(catalogService.search).mockRejectedValue(new LibraryApiError('Forbidden', 403));

    const { result } = renderSearch();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as LibraryApiError)?.statusCode).toBe(403);
  });
});
