'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Library } from 'lucide-react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { SecureCoverImage } from './SecureCoverImage';
import { useBook } from '../hooks/useBooks';
import { useLibrarianPermissions } from '../hooks/useLibrarianPermissions';
import { BookServiceError } from '../services/book.service';
import { bookEditRoute } from '../utils/libraryRoutes';

export interface BookDetailViewProps {
  bookId: string;
}

export function BookDetailView({ bookId }: BookDetailViewProps) {
  const { data: book, isLoading, isError, error } = useBook(bookId);
  const permissions = useLibrarianPermissions();
  const canEdit = permissions.includes('catalog');

  if (isLoading) {
    return (
      <SectionContainer className="py-12" aria-busy="true" aria-label="Loading book details">
        <div className="flex animate-pulse gap-8">
          <div className="h-56 w-40 shrink-0 rounded bg-gray-200" />
          <div className="flex-1 space-y-4">
            <div className="h-8 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-40 w-full rounded bg-gray-200" />
          </div>
        </div>
      </SectionContainer>
    );
  }

  // Invalid or unavailable ids fall through to the library not-found state.
  if (isError) {
    if (error instanceof BookServiceError && error.status === 404) {
      notFound();
    }
    return (
      <SectionContainer className="py-12">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Unable to load this book</p>
          <p className="mt-1 text-sm">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
          <Link
            href="/catalog/search"
            className="mt-3 inline-block rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900"
          >
            Back to search
          </Link>
        </div>
      </SectionContainer>
    );
  }

  if (!book) return null;

  return (
    <SectionContainer className="py-12">
      <article className="flex flex-col gap-8 lg:flex-row">
        <div className="w-40 shrink-0">
          <SecureCoverImage src={book.coverUrl} alt={book.bibliographic.title} size="lg" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{book.bibliographic.title}</h1>
          <p className="mt-2 text-gray-600">
            {book.contributors
              .filter((c) => c.role === 'author')
              .map((c) => c.name)
              .join(', ') || 'Unknown author'}
          </p>

          {book.bibliographic.isbn && (
            <p className="mt-1 text-sm text-gray-500">ISBN {book.bibliographic.isbn}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <Library className="h-3.5 w-3.5" aria-hidden="true" />
              {book.bibliographic.language}
            </span>
            {book.bibliographic.publicationYear && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                {book.bibliographic.publicationYear}
              </span>
            )}
            {book.taxonomy.subjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
              >
                {subject}
              </span>
            ))}
          </div>

          {canEdit && (
            <div className="mt-6">
              <Link
                href={bookEditRoute(book.id)}
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
              >
                Edit record
              </Link>
            </div>
          )}

          <h2 className="mt-6 text-lg font-semibold text-gray-900">About this book</h2>
          <p className="mt-2 whitespace-pre-line text-gray-700">{book.bibliographic.description}</p>

          {book.holdings.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
              <ul className="mt-2 space-y-1">
                {book.holdings.map((holding) => (
                  <li key={holding.callNumber} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{holding.location}</span>
                    <span className="text-gray-500">
                      {holding.callNumber} · {holding.copies} cop{holding.copies !== 1 ? 'ies' : 'y'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {book.digitalFormats.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Digital formats</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {book.digitalFormats.map((format) => (
                  <li
                    key={format.format}
                    className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600"
                  >
                    {format.format}
                    {format.fileSizeMb ? ` · ${format.fileSizeMb} MB` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>
    </SectionContainer>
  );
}