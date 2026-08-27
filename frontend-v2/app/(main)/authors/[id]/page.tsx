'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { useAuthor } from '@/src/features/library/hooks/useAuthor';
import { AuthorBibliography } from '@/src/features/library/components/AuthorBibliography';
import { LibraryApiError } from '@/src/features/library/services/library-api';

export default function AuthorProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: author, isLoading, isError, error } = useAuthor(id);

  if (isLoading) {
    return (
      <SectionContainer className="py-12">
        <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading author profile">
          <div className="flex items-start gap-6">
            <div className="h-32 w-32 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-1/3 rounded bg-gray-200" />
              <div className="h-4 w-1/4 rounded bg-gray-200" />
              <div className="h-20 w-full rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </SectionContainer>
    );
  }

  if (isError) {
    const isNotFound = error instanceof LibraryApiError && error.statusCode === 404;
    return (
      <SectionContainer className="py-12">
        <div className="py-12 text-center" role={isNotFound ? 'status' : 'alert'}>
          <p className="text-lg text-gray-500">
            {isNotFound ? 'Author not found.' : 'Unable to load author profile.'}
          </p>
          {!isNotFound && error instanceof Error && (
            <p className="mt-2 text-sm text-gray-400">{error.message}</p>
          )}
          <Link
            href="/catalog"
            className="mt-4 inline-block text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Browse catalog
          </Link>
        </div>
      </SectionContainer>
    );
  }

  if (!author) {
    return (
      <SectionContainer className="py-12">
        <div className="py-12 text-center" role="status">
          <p className="text-lg text-gray-500">Author not found.</p>
          <Link href="/catalog" className="mt-4 inline-block text-indigo-600 hover:underline">
            Browse catalog
          </Link>
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer className="py-12">
      <header className="mb-10 flex flex-col items-start gap-6 sm:flex-row">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-32 w-32 rounded-full border-2 border-gray-200 object-cover"
          />
        ) : (
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full bg-indigo-100 text-4xl font-bold text-indigo-600"
            aria-hidden="true"
          >
            {author.name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{author.name}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {author.nationality && (
              <>
                <dt className="sr-only">Nationality</dt>
                <dd>{author.nationality}</dd>
              </>
            )}
            {author.birthYear && (
              <>
                <dt className="sr-only">Years active</dt>
                <dd>
                  {author.birthYear}
                  {author.deathYear ? ` – ${author.deathYear}` : ' – present'}
                </dd>
              </>
            )}
            <dt className="sr-only">Book count</dt>
            <dd>
              {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}
            </dd>
          </dl>
          {author.website && (
            <a
              href={author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
            >
              Author website
            </a>
          )}
        </div>
      </header>

      {author.bio ? (
        <section className="mb-10" aria-labelledby="author-bio-heading">
          <h2 id="author-bio-heading" className="mb-3 text-xl font-semibold text-gray-900">
            About
          </h2>
          <p className="leading-relaxed text-gray-600">{author.bio}</p>
        </section>
      ) : (
        <p className="mb-10 text-gray-500" role="status">
          No biography available.
        </p>
      )}

      <section aria-labelledby="author-bibliography-heading">
        <h2 id="author-bibliography-heading" className="mb-4 text-xl font-semibold text-gray-900">
          Bibliography
        </h2>
        <AuthorBibliography authorId={id} />
      </section>
    </SectionContainer>
  );
}
