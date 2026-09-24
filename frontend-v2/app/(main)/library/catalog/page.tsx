'use client';

import React, { Suspense, useState } from 'react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { LibrarianNav } from '@/components/elibrary/LibrarianNav';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { CatalogResults } from '@/src/features/library/components/CatalogResults';
import { ArchivedBooksPanel } from '@/src/features/library/components/ArchivedBooksPanel';
import { useCatalogFacets } from '@/src/features/library/hooks/useCatalogFacets';

type CatalogView = 'active' | 'archived';

function ActiveCatalogPanel() {
  const catalogSearch = useCatalogFacets({ limit: 24 });

  return (
    <>
      <div className="mb-6">
        <SearchAutocomplete
          value={catalogSearch.query}
          onChange={catalogSearch.setQuery}
          onSubmit={catalogSearch.setQuery}
          placeholder="Search catalog by title, author, ISBN…"
        />
      </div>

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
        <div className="min-w-0 flex-1">
          <CatalogResults
            query={catalogSearch.query}
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
        </div>
      </div>
    </>
  );
}

function LibrarianCatalogContent() {
  const [view, setView] = useState<CatalogView>('active');
  const permissions = ['catalog', 'circulation', 'patrons'] as const;

  return (
    <SectionContainer className="py-12">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full flex-shrink-0 lg:w-56">
          <LibrarianNav permissions={[...permissions]} activeHref="/library/catalog" />
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Catalog Management</h1>
            <p className="text-gray-600">
              Manage active titles and archived entries. Archived books are hidden from patron
              discovery.
            </p>
          </header>

          <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Catalog views">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'active'}
              onClick={() => setView('active')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                view === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Active catalog
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'archived'}
              onClick={() => setView('archived')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                view === 'archived'
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Archived
            </button>
          </div>

          {view === 'active' ? <ActiveCatalogPanel /> : <ArchivedBooksPanel isLibrarian />}
        </main>
      </div>
    </SectionContainer>
  );
}

export default function LibrarianCatalogPage() {
  return (
    <Suspense fallback={<div className="py-12" aria-busy="true" />}>
      <LibrarianCatalogContent />
    </Suspense>
  );
}
