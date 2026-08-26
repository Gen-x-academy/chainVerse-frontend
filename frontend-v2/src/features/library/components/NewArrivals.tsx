'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { SecureCoverImage } from './SecureCoverImage';

interface NewArrivalBook {
  id: string;
  title: string;
  coverUrl?: string;
  author?: string;
  addedAt: string;
  format?: string;
}

interface NewArrivalsProps {
  books: NewArrivalBook[];
}

export function NewArrivals({ books }: NewArrivalsProps) {
  if (books.length === 0) return null;

  return (
    <section aria-labelledby="new-arrivals-heading">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="new-arrivals-heading"
          className="text-xl font-semibold text-gray-900 flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 text-amber-500" aria-hidden="true" />
          New Arrivals
        </h2>
        <Link
          href="/catalog?sort=newest"
          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          View all new arrivals
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/courses/${book.id}`}
            className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <SecureCoverImage
              src={book.coverUrl}
              alt={book.title}
              size="md"
              className="w-full !h-40 !w-auto rounded-none"
            />
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {book.title}
              </h3>
              {book.author && (
                <p className="text-xs text-gray-500 mt-1 truncate">{book.author}</p>
              )}
              <p className="text-xs text-amber-600 mt-1">
                Added {new Date(book.addedAt).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
