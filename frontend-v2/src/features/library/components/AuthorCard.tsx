'use client';

import Link from 'next/link';
import type { AuthorSummary } from '../types/author.types';

export interface AuthorCardProps {
  author: AuthorSummary;
  className?: string;
}

/** Compact author card linking to the author profile page. */
export function AuthorCard({ author, className = '' }: AuthorCardProps) {
  return (
    <Link
      href={`/authors/${author.id}`}
      className={`flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
      aria-label={`View profile for ${author.name}, ${author.bookCount} books`}
    >
      {author.avatarUrl ? (
        <img
          src={author.avatarUrl}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600"
          aria-hidden="true"
        >
          {author.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-gray-900">{author.name}</h3>
        <p className="text-sm text-gray-500">
          {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}
          {author.nationality ? ` · ${author.nationality}` : ''}
        </p>
      </div>
    </Link>
  );
}
