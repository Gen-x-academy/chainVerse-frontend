import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogSearchPanel } from '../CatalogSearchPanel';

vi.mock('../../hooks/useLibraryQuery', () => ({
  useLibraryCatalogSearch: vi.fn(),
}));

import type { CatalogSearchResponse } from '../../types/catalog.types';
import { useLibraryCatalogSearch } from '../../hooks/useLibraryQuery';

const baseSearch = (overrides: Record<string, unknown>) => ({
  query: '',
  setQuery: vi.fn(),
  facets: {},
  setFacets: vi.fn(),
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  isPlaceholderData: false,
  canGoBack: false,
  canGoNext: false,
  goPrev: vi.fn(),
  goNext: vi.fn(),
  refetch: vi.fn(),
  ...overrides,
});

const items: CatalogSearchResponse = {
  data: [
    { id: 'book-1', title: 'Clean Code', authorName: 'Robert Martin', year: 2008 },
    { id: 'book-2', title: 'Refactoring', authorName: 'Martin Fowler' },
  ],
  nextCursor: null,
  prevCursor: null,
  total: 2,
};

describe('CatalogSearchPanel', () => {
  it('links book results to the canonical book detail route, never the course route', () => {
    vi.mocked(useLibraryCatalogSearch).mockReturnValue(
      baseSearch({ query: 'code', data: items }) as ReturnType<typeof useLibraryCatalogSearch>
    );
    render(<CatalogSearchPanel />);

    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href')?.startsWith('/catalog/book-1'))).toBe(true);
    expect(links.some((l) => l.getAttribute('href')?.startsWith('/catalog/book-2'))).toBe(true);
    expect(links.some((l) => l.getAttribute('href')?.includes('/courses'))).toBe(false);
  });

  it('shows a loading skeleton while searching', () => {
    vi.mocked(useLibraryCatalogSearch).mockReturnValue(
      baseSearch({ query: 'code', isLoading: true }) as ReturnType<typeof useLibraryCatalogSearch>
    );
    render(<CatalogSearchPanel />);
    expect(screen.getByText('Search the Catalog')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('shows the empty state when there are no results', () => {
    vi.mocked(useLibraryCatalogSearch).mockReturnValue(
      baseSearch({
        query: 'no-such-book',
        data: { data: [], nextCursor: null, prevCursor: null, total: 0 },
      }) as ReturnType<typeof useLibraryCatalogSearch>
    );
    render(<CatalogSearchPanel />);
    expect(screen.getByText(/No results found for "no-such-book"/)).toBeInTheDocument();
  });

  it('shows an error state when the search request fails', () => {
    vi.mocked(useLibraryCatalogSearch).mockReturnValue(
      baseSearch({
        isError: true,
        error: new Error('Catalog service unavailable'),
      }) as ReturnType<typeof useLibraryCatalogSearch>
    );
    render(<CatalogSearchPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Catalog service unavailable');
  });
});