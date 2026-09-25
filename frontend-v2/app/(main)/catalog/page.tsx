'use client';

import React, { Suspense } from 'react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { CatalogResults } from '@/src/features/library/components/CatalogResults';
import { AuthorCard } from '@/src/features/library/components/AuthorCard';
import { useAuthorSearch } from '@/src/features/library/hooks/useAuthor';
import { useCatalogSearch } from '@/src/features/library/hooks/useCatalogSearch';

function CatalogPageContent() {
  const catalogSearch = useCatalogSearch({ limit: 24 });
  const { data: authorResults, isLoading: authorsLoading } = useAuthorSearch(
    catalogSearch.debouncedQuery
  );

  return (
    <SectionContainer className="py-12">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Library Catalog</h1>
        <p className="text-gray-600">Search our collection of books, ebooks, and audiobooks.</p>
      </div>

      <div className="mb-6">
        <SearchAutocomplete
          value={catalogSearch.query}
          onChange={catalogSearch.setQuery}
          onSubmit={catalogSearch.setQuery}
          suggestions={catalogSearch.suggestions}
          placeholder="Search by title, author, ISBN..."
          isLoading={catalogSearch.isFetching}
        />
      </div>

      {catalogSearch.query.trim().length >= 2 && (
        <section className="mb-8" aria-labelledby="author-results-heading">
          <h2 id="author-results-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Authors
          </h2>
          {authorsLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : authorResults?.data?.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {authorResults.data.map((author) => (
                <AuthorCard key={author.id} author={author} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500" role="status">
              No matching authors.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full flex-shrink-0 lg:w-64">
          <FacetedFilter
            facets={catalogSearch.facets}
            selected={catalogSearch.selectedFacets}
            onChange={catalogSearch.setFacets}
            isLoading={catalogSearch.isLoading}
            error={catalogSearch.error instanceof Error ? catalogSearch.error.message : null}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <CatalogResults
            query={catalogSearch.debouncedQuery}
            data={catalogSearch.data}
            isLoading={catalogSearch.isLoading}
            isError={catalogSearch.isError}
            error={catalogSearch.error}
            isFetching={catalogSearch.isFetching}
            isPlaceholderData={catalogSearch.isPlaceholderData}
            canGoBack={catalogSearch.canGoBack}
            canGoNext={catalogSearch.canGoNext}
            onPrev={catalogSearch.goPrev}
            onNext={catalogSearch.goNext}
          />
        </main>
      </div>
    </SectionContainer>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="py-12" aria-busy="true" />}>
      <CatalogPageContent />
    </Suspense>
  );
}
