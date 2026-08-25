'use client';

import React, { useState } from 'react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { SecureCoverImage } from '@/src/features/library/components/SecureCoverImage';
import Link from 'next/link';
import type { Facet } from '@/src/features/library/components/FacetedFilter';

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
    key: 'genre',
    label: 'Genre',
    options: [
      { value: 'fiction', label: 'Fiction', count: 200 },
      { value: 'non-fiction', label: 'Non-Fiction', count: 150 },
      { value: 'science', label: 'Science', count: 60 },
      { value: 'history', label: 'History', count: 45 },
    ],
  },
];

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});

  return (
    <SectionContainer className="py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Library Catalog</h1>
        <p className="text-gray-600">Search our collection of books, ebooks, and audiobooks.</p>
      </div>

      <div className="mb-6">
        <SearchAutocomplete
          value={query}
          onChange={setQuery}
          onSubmit={(q) => setQuery(q)}
          placeholder="Search by title, author, ISBN..."
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FacetedFilter
            facets={MOCK_FACETS}
            selected={selectedFacets}
            onChange={setSelectedFacets}
          />
        </aside>

        {/* Results */}
        <main className="flex-1">
          <p className="text-sm text-gray-500 mb-4">
            Showing <span className="font-medium text-gray-900">0</span> results
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Empty state */}
            <div className="col-span-full text-center py-16">
              <p className="text-gray-500 text-lg">
                {query ? `No results for "${query}"` : 'Start searching to find books.'}
              </p>
            </div>
          </div>
        </main>
      </div>
    </SectionContainer>
  );
}
