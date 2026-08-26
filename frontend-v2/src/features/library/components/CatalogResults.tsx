'use client';

import React from 'react';
import Link from 'next/link';
import { SecureCoverImage } from './SecureCoverImage';
import { LibraryPagination } from './LibraryPagination';
import { useLibraryCatalogSearch } from '../hooks/useLibraryQuery';
import type { CatalogItem, CatalogSearchResponse } from '../types/catalog.types';

export interface CatalogResultsProps {
  query?: string;
  data?: CatalogSearchResponse;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  isPlaceholderData: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  includeArchived?: boolean;
}

function CatalogResultCard({ item }: { item: CatalogItem }) {
  if (item.isArchived) return null;

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md">
      <Link
        href={`/catalog/${item.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`View ${item.title}${item.authorName ? ` by ${item.authorName}` : ''}`}
      >
        <SecureCoverImage src={item.coverUrl} alt={item.title} size="lg" className="w-full h-48" />
      </Link>
      <div className="p-3">
        <Link
          href={`/catalog/${item.id}`}
          className="line-clamp-2 font-medium text-gray-900 hover:text-indigo-600"
        >
          {item.title}
        </Link>
        {item.authorName && (
          <p className="mt-1 text-sm text-gray-500">
            {item.authorId ? (
              <Link href={`/authors/${item.authorId}`} className="hover:text-indigo-600 hover:underline">
                {item.authorName}
              </Link>
            ) : (
              item.authorName
            )}
          </p>
        )}
        {item.format && (
          <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {item.format}
          </span>
        )}
      </div>
    </article>
  );
}

export function CatalogResults({
  query = '',
  data,
  isLoading,
  isError,
  error,
  isFetching,
  isPlaceholderData,
  canGoBack,
  canGoNext,
  onPrev,
  onNext,
  includeArchived = false,
}: CatalogResultsProps) {
  const items = (data?.data ?? []).filter((item) => includeArchived || !item.isArchived);
  const showStaleGuard = isFetching && isPlaceholderData;

  if (isLoading && !data) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
        aria-label="Loading catalog results"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border p-4">
            <div className="mb-3 h-48 rounded bg-gray-200" />
            <div className="h-5 w-2/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Search failed</p>
        <p className="mt-1 text-sm">
          {error instanceof Error ? error.message : 'Unable to load catalog results.'}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-gray-500" role="status">
        {query ? `No results for "${query}"` : 'Start searching to find books.'}
      </p>
    );
  }

  return (
    <div aria-busy={showStaleGuard || undefined}>
      <p className="mb-4 text-sm text-gray-500" aria-live="polite">
        Showing {items.length} of {data?.total ?? items.length} results
        {showStaleGuard ? ' (updating…)' : ''}
      </p>

      {/*
        Virtualization guidance (#922): for fixtures > 200 rows, wrap this grid in
        @tanstack/react-virtual with a fixed row height (~280px) and overscan of 4.
        Keep cursor page size at 24–48 so DOM nodes stay bounded between fetches.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <CatalogResultCard key={item.id} item={item} />
        ))}
      </div>

      <LibraryPagination
        className="mt-8"
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        onPrev={onPrev}
        onNext={onNext}
        isLoading={isFetching}
      />
    </div>
  );
}

/** Owns search + cursor pagination state for standalone catalog views. */
export function CatalogResultsContainer(props: { includeArchived?: boolean }) {
  const search = useLibraryCatalogSearch({ limit: 24, includeArchived: props.includeArchived });
  return (
    <CatalogResults
      query={search.query}
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
      includeArchived={props.includeArchived}
    />
  );
}
