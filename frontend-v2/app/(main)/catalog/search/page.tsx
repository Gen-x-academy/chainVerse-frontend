'use client';

import { CatalogSearchPanel } from '@/src/features/library/components/CatalogSearchPanel';

export default function CatalogSearchPage() {
  return <CatalogSearchPanel />;
import React, { Suspense } from 'react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { CatalogResults } from '@/src/features/library/components/CatalogResults';
import { useCatalogSearch } from '@/src/features/library/hooks/useCatalogSearch';

function CatalogSearchContent() {
  const search = useCatalogSearch({ limit: 24 });

  return (
    <SectionContainer className="py-12">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search the Catalog</h1>
        <p className="text-gray-600 mb-6">
          Find books, ebooks, audiobooks, and more across our entire collection.
        </p>
        <SearchAutocomplete
          value={search.query}
          onChange={search.setQuery}
          onSubmit={search.setQuery}
          placeholder="Search by title, author, ISBN, or keyword..."
          isLoading={search.isFetching}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mt-8">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FacetedFilter
            facets={search.facets}
            selected={search.selectedFacets}
            onChange={search.setFacets}
            isLoading={search.isLoading}
            error={search.error instanceof Error ? search.error.message : null}
          />
        </aside>

        <main className="flex-1 min-w-0">
          <CatalogResults
            query={search.debouncedQuery}
            data={search.data}
            isLoading={search.isLoading}
            isError={search.isError}
            error={search.error}
            isFetching={search.isFetching}
            isPlaceholderData={search.isPlaceholderData}
            canGoBack={search.canGoBack}
            canGoNext={search.canGoNext}
            onPrev={search.goPrev}
            onNext={search.goNext}
          />
        </main>
      </div>
    </SectionContainer>
  );
}

export default function CatalogSearchPage() {
  return (
    <Suspense fallback={<div className="py-12" aria-busy="true" />}>
      <CatalogSearchContent />
    </Suspense>
  );
}