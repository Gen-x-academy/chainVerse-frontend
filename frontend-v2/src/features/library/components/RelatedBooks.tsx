'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface RelatedBook {
  id: string;
  title: string;
  coverUrl?: string;
  author?: string;
}

interface RelatedBooksProps {
  books: RelatedBook[];
  title?: string;
}

export function RelatedBooks({ books, title = 'Related Books' }: RelatedBooksProps) {
  if (books.length === 0) return null;

  return (
    <section aria-labelledby="related-books-heading" className="mt-8">
      <h2 id="related-books-heading" className="text-xl font-semibold text-gray-900 mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/courses/${book.id}`}
            className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-32 sm:h-40 object-cover"
              />
            ) : (
              <div className="w-full h-32 sm:h-40 bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-gray-300" />
              </div>
            )}
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {book.title}
              </h3>
              {book.author && (
                <p className="text-xs text-gray-500 mt-1 truncate">{book.author}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
