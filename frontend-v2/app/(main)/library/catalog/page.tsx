'use client';

import Link from 'next/link';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import {
  hasLibrarianPermission,
  useLibrarianPermissions,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import { useBookList } from '@/src/features/library/hooks/useBooks';
import { STATUS_LABELS } from '@/src/features/library/utils/book-lifecycle';
import {
  bookEditRoute,
  libraryCatalogRoute,
} from '@/src/features/library/utils/libraryRoutes';

export default function CatalogAdminPage() {
  const permissions = useLibrarianPermissions();
  const canCreate = hasLibrarianPermission(permissions, 'catalog');
  const { data, isLoading, error } = useBookList();

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref={libraryCatalogRoute}
      title="Catalog administration"
      description="Manage bibliographic records and holdings."
      allowed={canCreate}
    >
      <div className="flex flex-col gap-3 mb-6 sm:flex-row">
        <Link
          href="/library/catalog/create"
          className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Create book record
        </Link>
        <Link
          href="/library/acquisitions/import"
          className="inline-flex justify-center rounded-lg border px-4 py-2 text-sm"
        >
          Import by ISBN
        </Link>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500" aria-label="Loading catalog">
          Loading catalog…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">No book records yet.</p>
      )}

      {data && data.data.length > 0 && (
        <ul className="divide-y rounded-lg border bg-white">
          {data.data.map((book) => (
            <li
              key={book.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{book.bibliographic.title}</p>
                <p className="text-xs text-gray-500 capitalize">{STATUS_LABELS[book.status]}</p>
              </div>
              <Link
                href={bookEditRoute(book.id)}
                className="text-sm text-indigo-600 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LibrarianPageShell>
  );
}
import React, { Suspense, useState } from 'react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { LibrarianNav } from '@/components/elibrary/LibrarianNav';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { CatalogResults } from '@/src/features/library/components/CatalogResults';
import { ArchivedBooksPanel } from '@/src/features/library/components/ArchivedBooksPanel';
import { useCatalogFacets } from '@/src/features/library/hooks/useCatalogFacets';
import { useCatalogSearch } from '@/src/features/library/hooks/useCatalogSearch';

type CatalogView = 'active' | 'archived';

function ActiveCatalogPanel() {
  const catalogSearch = useCatalogFacets({ limit: 24 });
  const catalogSearch = useCatalogSearch({ limit: 24 });

  return (
    <>
      <div className="mb-6">
        <SearchAutocomplete
          value={catalogSearch.query}
          onChange={catalogSearch.setQuery}
          onSubmit={catalogSearch.setQuery}
          suggestions={catalogSearch.suggestions}
          placeholder="Search catalog by title, author, ISBN…"
          isLoading={catalogSearch.isFetching}
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
