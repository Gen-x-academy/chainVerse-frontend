'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthorBooks } from '../hooks/useAuthor';
import type { AuthorBook } from '../types/author.types';

const PAGE_SIZE = 12;

export interface AuthorBibliographyProps {
  authorId: string;
}

function BookCard({ book }: { book: AuthorBook }) {
  return (
    <Link
      href={`/catalog/${book.id}`}
      className="overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      aria-label={`View ${book.title}${book.year ? `, published ${book.year}` : ''}`}
    >
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-gray-400">
          No cover
        </div>
      )}
      <div className="p-3">
        <h3 className="line-clamp-2 font-medium text-gray-900">{book.title}</h3>
        {book.year && <p className="mt-1 text-sm text-gray-500">{book.year}</p>}
        {book.format && (
          <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {book.format}
          </span>
        )}
      </div>
    </Link>
  );
}

export function AuthorBibliography({ authorId }: AuthorBibliographyProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useAuthorBooks(
    authorId,
    page,
    PAGE_SIZE
  );

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading bibliography"
        aria-busy="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-lg border p-4">
            <div className="h-40 rounded bg-gray-200" />
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load bibliography</p>
        <p className="mt-1 text-sm">{error instanceof Error ? error.message : 'Please try again.'}</p>
      </div>
    );
  }

  const books = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (books.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500" role="status">
        No books found for this author.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500" aria-live="polite">
        Showing {books.length} of {total} works
        {isFetching ? ' (updating…)' : ''}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-center gap-2"
          aria-label="Bibliography pagination"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            aria-label="Previous page"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? 'page' : undefined}
              className={`rounded border px-3 py-1 text-sm ${
                page === p ? 'bg-indigo-600 text-white' : ''
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
