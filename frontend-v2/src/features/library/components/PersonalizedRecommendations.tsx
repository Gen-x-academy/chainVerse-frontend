'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { SecureCoverImage } from './SecureCoverImage';

interface RecommendedBook {
  id: string;
  title: string;
  coverUrl?: string;
  author?: string;
  reason?: string;
}

interface PersonalizedRecommendationsProps {
  books: RecommendedBook[];
  isLoading?: boolean;
}

export function PersonalizedRecommendations({ books, isLoading }: PersonalizedRecommendationsProps) {
  if (isLoading) {
    return (
      <section aria-labelledby="recommendations-heading">
        <h2 id="recommendations-heading" className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          Recommended for You
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-gray-200 rounded-lg overflow-hidden">
              <div className="h-40 bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (books.length === 0) return null;

  return (
    <section aria-labelledby="recommendations-heading">
      <h2 id="recommendations-heading" className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-500" aria-hidden="true" />
        Recommended for You
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
              {book.reason && (
                <p className="text-xs text-indigo-500 mt-1.5 line-clamp-1">{book.reason}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
