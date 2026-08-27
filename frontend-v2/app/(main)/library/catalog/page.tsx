'use client';

import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';

export default function CatalogAdminPage() {
  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage catalog records, imports, exports, and duplicate resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/library/catalog/duplicates"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Duplicate records</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compare and merge suspected duplicate catalog entries.
            </p>
          </Link>
          <Link
            href="/library/catalog/import"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Bulk import</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload CSV or JSON with validation and row-level error reporting.
            </p>
          </Link>
          <Link
            href="/library/catalog/export"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Bulk export</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Export filtered catalog metadata and holdings.
            </p>
          </Link>
        </div>
      </div>
    </LibraryAdminLayout>
import React from 'react';
import Link from 'next/link';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import { useLibrarianPermissions, useCanPerformLibrarianAction } from '@/src/features/library/hooks/useLibrarianPermissions';
import { useBookList } from '@/src/features/library/hooks/useBooks';
import { STATUS_LABELS } from '@/src/features/library/utils/book-lifecycle';

export default function LibraryCatalogPage() {
  const permissions = useLibrarianPermissions('admin');
  const canCreate = useCanPerformLibrarianAction(permissions, 'book.create');
  const { data, isLoading, error } = useBookList();

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref="/library/catalog"
      title="Catalog administration"
      description="Manage bibliographic records and holdings."
      allowed={permissions.includes('catalog')}
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {canCreate && (
          <Link
            href="/library/catalog/create"
            className="inline-flex justify-center px-4 py-2 text-sm bg-gray-900 text-white rounded-lg"
          >
            Create book record
          </Link>
        )}
        <Link
          href="/library/acquisitions/import"
          className="inline-flex justify-center px-4 py-2 text-sm border rounded-lg"
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
        <ul className="divide-y border rounded-lg bg-white">
          {data.data.map((book) => (
            <li key={book.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">{book.bibliographic.title}</p>
                <p className="text-xs text-gray-500 capitalize">{STATUS_LABELS[book.status]}</p>
              </div>
              <Link
                href={`/library/catalog/${book.id}/edit`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LibrarianPageShell>
import React, { useState } from 'react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { LibrarianNav } from '@/components/elibrary/LibrarianNav';
import { SearchAutocomplete } from '@/src/features/library/components/SearchAutocomplete';
import { FacetedFilter } from '@/src/features/library/components/FacetedFilter';
import { CatalogResults } from '@/src/features/library/components/CatalogResults';
import { ArchivedBooksPanel } from '@/src/features/library/components/ArchivedBooksPanel';
import { useLibraryCatalogSearch } from '@/src/features/library/hooks/useLibraryQuery';
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
];

type CatalogView = 'active' | 'archived';

function ActiveCatalogPanel() {
  const catalogSearch = useLibraryCatalogSearch({ limit: 24 });

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
            facets={MOCK_FACETS}
            selected={catalogSearch.facets}
            onChange={catalogSearch.setFacets}
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

export default function LibrarianCatalogPage() {
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
