'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { useAuthor, useAuthorBooks } from '@/src/features/library/hooks/useAuthor';

export default function AuthorProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: author, isLoading: authorLoading, error: authorError } = useAuthor(id);
  const { data: books, isLoading: booksLoading } = useAuthorBooks(id);

  if (authorLoading) {
    return (
      <SectionContainer className="py-12">
        <div className="animate-pulse space-y-6">
          <div className="flex items-start gap-6">
            <div className="w-32 h-32 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-20 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </SectionContainer>
    );
  }

  if (authorError || !author) {
    return (
      <SectionContainer className="py-12">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Author not found.</p>
          <Link href="/courses" className="text-indigo-600 hover:underline mt-4 inline-block">
            Browse catalog
          </Link>
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer className="py-12">
      {/* Author Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center text-4xl font-bold text-indigo-600">
            {author.name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{author.name}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
            {author.nationality && <span>{author.nationality}</span>}
            {author.birthYear && (
              <span>
                {author.birthYear}{author.deathYear ? ` - ${author.deathYear}` : ' - present'}
              </span>
            )}
            <span>{author.bookCount} books</span>
          </div>
          {author.website && (
            <a
              href={author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline text-sm mt-2 inline-block"
            >
              Author Website
            </a>
          )}
        </div>
      </div>

      {/* Bio */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About</h2>
        <p className="text-gray-600 leading-relaxed">{author.bio}</p>
      </div>

      {/* Bibliography */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Bibliography</h2>
        {booksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse border rounded-lg p-4 space-y-3">
                <div className="h-40 bg-gray-200 rounded" />
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : !books || books.length === 0 ? (
          <p className="text-gray-500">No books found for this author.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book: { id: string; title: string; coverUrl?: string; year?: number }) => (
              <Link
                key={book.id}
                href={`/courses/${book.id}`}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                    No cover
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 line-clamp-2">{book.title}</h3>
                  {book.year && <p className="text-sm text-gray-500 mt-1">{book.year}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
