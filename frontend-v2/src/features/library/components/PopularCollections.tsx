'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, Star, BookOpen } from 'lucide-react';
import { SecureCoverImage } from './SecureCoverImage';

interface CollectionBook {
  id: string;
  title: string;
  coverUrl?: string;
  author?: string;
  rating?: number;
}

interface BookCollection {
  id: string;
  name: string;
  description?: string;
  books: CollectionBook[];
}

interface PopularCollectionsProps {
  collections: BookCollection[];
}

export function PopularCollections({ collections }: PopularCollectionsProps) {
  if (collections.length === 0) return null;

  return (
    <div className="space-y-10">
      {collections.map((collection) => (
        <section key={collection.id} aria-labelledby={`collection-${collection.id}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                id={`collection-${collection.id}`}
                className="text-xl font-semibold text-gray-900 flex items-center gap-2"
              >
                <TrendingUp className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                {collection.name}
              </h2>
              {collection.description && (
                <p className="text-sm text-gray-500 mt-1">{collection.description}</p>
              )}
            </div>
            <Link
              href={`/courses?collection=${collection.id}`}
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {collection.books.map((book) => (
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
                  {book.rating !== undefined && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-gray-600">{book.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
