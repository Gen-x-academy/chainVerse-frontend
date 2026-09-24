'use client';

import React, { useCallback } from 'react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { SearchAutocomplete } from './SearchAutocomplete';
import { FacetedFilter } from './FacetedFilter';
import { SecureCoverImage } from './SecureCoverImage';
import { useLibraryCatalogSearch } from '../hooks/useLibraryQuery';
import { bookDetailRoute } from '../utils/libraryRoutes';
import Link from 'next/link';
import type { Facet } from './FacetedFilter';

const MOCK_SUGGESTIONS = [
  'Introduction to Algorithms',
  'Clean Code',
  'The Pragmatic Programmer',
  'Design Patterns',
  'Refactoring',
];

const MOCK_FACETS: Facet[] = [
  {
    key: 'format',
    label: 'Format',
    options: [
      { value: 'print', label: 'Print', count: 120 },
      { value: 'ebook', label: 'E-book', count: 85 },
      { value: 'audiobook', label: 'Audiobook', count: 42 },
    ],
  },
  {
    key: 'year',
    label: 'Publication Year',
    options: [
      { value: '2024', label: '2024', count: 30 },
      { value: '2023', label: '2023', count: 55 },
      { value: '2022', label: '2022', count: 40 },
      { value: 'older', label: 'Before 2022', count: 200 },
    ],
  },
];

export function CatalogSearchPanel() {
  const search = useLibraryCatalogSearch({ limit: 24 });

  const handleSubmit = useCallback(
    (value: string) => {
      search.setQuery(value);
    },
    [search]
  );

  const items = search.data?.data ?? [];

  return (
    <SectionContainer className="py-12">
      <div className="mx-auto mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Search the Catalog</h1>
        <p className="mb-6 text-gray-600">
          Find books, ebooks, audiobooks, and more across our entire collection.
        </p>
        <SearchAutocomplete
          value={search.query}
          onChange={search.setQuery}
          onSubmit={handleSubmit}
          suggestions={MOCK_SUGGESTIONS}
          placeholder="Search by title, author, ISBN, or keyword..."
          isLoading={search.isLoading}
        />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <aside className="w-full flex-shrink-0 lg:w-64">
          <FacetedFilter
            facets={MOCK_FACETS}
            selected={search.facets}
            onChange={search.setFacets}
          />
        </aside>

        <main className="flex-1" aria-live="polite">
          {search.isLoading && search.data === undefined ? (
            <div className="space-y-4" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4 rounded-lg border p-4">
                  <div className="h-28 w-20 rounded bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 rounded bg-gray-200" />
                    <div className="h-4 w-1/3 rounded bg-gray-200" />
                    <div className="h-12 w-full rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : search.isError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
            >
              <p className="font-medium">Search failed</p>
              <p className="mt-1 text-sm">
                {search.error instanceof Error
                  ? search.error.message
                  : 'Unable to load catalog results.'}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg text-gray-500" role="status">
                {search.query
                  ? `No results found for "${search.query}"`
                  : 'Enter a search term to begin.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Showing {items.length} of {search.data?.total ?? items.length} results
              </p>
              <ul className="space-y-4">
                {items.map((result) => (
                  <li key={result.id}>
                    <Link
                      href={bookDetailRoute(result.id)}
                      className="group flex gap-4 rounded-lg border border-gray-200 p-4 transition hover:shadow-md"
                    >
                      <SecureCoverImage src={result.coverUrl} alt={result.title} size="md" />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold text-gray-900 transition group-hover:text-indigo-600">
                          {result.title}
                        </h2>
                        {result.authorName && (
                          <p className="text-sm text-gray-500">{result.authorName}</p>
                        )}
                        {result.year && <p className="text-sm text-gray-400">{result.year}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </SectionContainer>
  );
}