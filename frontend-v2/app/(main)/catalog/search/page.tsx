'use client';

import React, { useState, useCallback } from 'react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { SecureCoverImage } from '@/src/features/library/components/SecureCoverImage';
import Link from 'next/link';
import type { Facet } from '@/src/features/library/components/FacetedFilter';

interface SearchResult {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  year?: number;
  format?: string;
  snippet?: string;
}

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

export default function CatalogSearchPage() {
  const [query, setQuery] = useState('');
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setIsSearching(true);
    setHasSearched(true);
    // Simulated search delay
    setTimeout(() => {
      setResults([]);
      setIsSearching(false);
    }, 500);
  }, []);

  return (
    <SectionContainer className="py-12">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search the Catalog</h1>
        <p className="text-gray-600 mb-6">
          Find books, ebooks, audiobooks, and more across our entire collection.
        </p>
        <SearchAutocomplete
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          suggestions={MOCK_SUGGESTIONS}
          placeholder="Search by title, author, ISBN, or keyword..."
          isLoading={isSearching}
        />
      </div>

      {hasSearched && (
        <div className="flex flex-col lg:flex-row gap-8 mt-8">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <FacetedFilter
              facets={MOCK_FACETS}
              selected={selectedFacets}
              onChange={setSelectedFacets}
            />
          </aside>

          <main className="flex-1">
            {isSearching ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4 p-4 border rounded-lg">
                    <div className="w-20 h-28 bg-gray-200 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-2/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-12 bg-gray-200 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">
                  {query ? `No results found for "${query}"` : 'Enter a search term to begin.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={`/courses/${result.id}`}
                    className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition group"
                  >
                    <SecureCoverImage src={result.coverUrl} alt={result.title} size="md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                        {result.title}
                      </h3>
                      <p className="text-sm text-gray-500">{result.author}</p>
                      {result.snippet && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.snippet}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      )}
    </SectionContainer>
  );
}
