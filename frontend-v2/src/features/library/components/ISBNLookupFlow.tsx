'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isbnSchema, type BookCreateFormValues } from '../schemas/book.schema';
import { z } from 'zod';
import type { ISBNLookupResult } from '../types/book.types';
import { BookCreateForm } from './BookCreateForm';
import type { BookCreatePayload } from '../types/book.types';
import { cn } from '@/lib/utils';

const isbnFormSchema = z.object({ isbn: isbnSchema });
type ISBNFormValues = z.infer<typeof isbnFormSchema>;

const PROVENANCE_LABELS: Record<ISBNLookupResult['provenance'], string> = {
  'open-library': 'Open Library',
  'google-books': 'Google Books',
  internal: 'Internal catalog',
};

export interface ISBNLookupFlowProps {
  onLookup: (isbn: string) => Promise<ISBNLookupResult>;
  onImport: (payload: BookCreatePayload) => void | Promise<void>;
  loading?: boolean;
  importLoading?: boolean;
  lookupError?: string | null;
  className?: string;
}

type FlowStep = 'entry' | 'review' | 'form';

function lookupToFormDefaults(result: ISBNLookupResult): Partial<BookCreateFormValues> {
  return {
    bibliographic: {
      title: result.bibliographic.title ?? '',
      subtitle: result.bibliographic.subtitle ?? '',
      description: result.bibliographic.description ?? '',
      isbn: result.isbn.length === 10 ? result.isbn : '',
      isbn13: result.isbn.length === 13 ? result.isbn : result.bibliographic.isbn13 ?? '',
      publisher: result.bibliographic.publisher ?? '',
      publicationYear: result.bibliographic.publicationYear,
      language: result.bibliographic.language ?? 'en',
      pages: result.bibliographic.pages,
    },
    contributors: result.contributors.length > 0 ? result.contributors : [{ name: '', role: 'author' }],
    taxonomy: {
      subjects: result.taxonomy?.subjects?.length ? result.taxonomy.subjects : [''],
      deweyDecimal: result.taxonomy?.deweyDecimal ?? '',
      audience: result.taxonomy?.audience ?? 'general',
    },
    holdings: [{ location: 'Main', callNumber: '', copies: 1 }],
    digitalFormats: [],
    coverUrl: result.coverUrl ?? '',
    status: 'draft',
  };
}

export function ISBNLookupFlow({
  onLookup,
  onImport,
  loading = false,
  importLoading = false,
  lookupError = null,
  className,
}: ISBNLookupFlowProps) {
  const [step, setStep] = useState<FlowStep>('entry');
  const [lookupResult, setLookupResult] = useState<ISBNLookupResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ISBNFormValues>({
    resolver: zodResolver(isbnFormSchema),
    defaultValues: { isbn: '' },
  });

  const lookupIsbn = handleSubmit(async ({ isbn }) => {
    setLocalError(null);
    try {
      const result = await onLookup(isbn);
      setLookupResult(result);
      setStep('review');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Lookup failed');
    }
  });

  const displayError = localError ?? lookupError;

  if (step === 'form' && lookupResult) {
    return (
      <div className={className}>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
          <p className="font-medium text-blue-900">Imported metadata review</p>
          <p className="text-blue-700 mt-1">
            Source: {PROVENANCE_LABELS[lookupResult.provenance]} · fetched{' '}
            {new Date(lookupResult.fetchedAt).toLocaleString()}
          </p>
          <p className="text-blue-600 text-xs mt-1">
            External metadata is saved as a draft only — it will not be auto-published.
          </p>
        </div>
        <BookCreateForm
          defaultValues={lookupToFormDefaults(lookupResult)}
          onSubmit={onImport}
          loading={importLoading}
        />
      </div>
    );
  }

  if (step === 'review' && lookupResult) {
    const bib = lookupResult.bibliographic;
    return (
      <div className={cn('space-y-4', className)}>
        <div
          className="p-4 border rounded-lg bg-amber-50 border-amber-100"
          data-testid="import-provenance"
        >
          <p className="text-sm font-medium text-amber-900">Metadata provenance</p>
          <p className="text-sm text-amber-800 mt-1">
            Imported from <strong>{PROVENANCE_LABELS[lookupResult.provenance]}</strong> for ISBN{' '}
            {lookupResult.isbn}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Retrieved {new Date(lookupResult.fetchedAt).toLocaleString()}. Review all fields before
            saving.
          </p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Title</dt>
            <dd className="font-medium">{bib.title ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Publisher</dt>
            <dd>{bib.publisher ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Description</dt>
            <dd className="line-clamp-4">{bib.description ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Contributors</dt>
            <dd>
              {lookupResult.contributors.map((c) => `${c.name} (${c.role})`).join(', ') || '—'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setStep('form')}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg"
          >
            Review and correct
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('entry');
              setLookupResult(null);
            }}
            className="px-4 py-2 text-sm border rounded-lg"
          >
            Look up different ISBN
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={cn('space-y-4', className)} onSubmit={(e) => void lookupIsbn(e)} noValidate>
      <div>
        <label htmlFor="isbn-input" className="block text-sm font-medium text-gray-700 mb-1">
          ISBN
        </label>
        <input
          id="isbn-input"
          placeholder="978-0-123456-78-9 or 0123456789"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          {...register('isbn')}
          aria-invalid={Boolean(errors.isbn)}
        />
        {errors.isbn && (
          <p className="text-red-600 text-xs mt-1" role="alert">
            {errors.isbn.message}
          </p>
        )}
      </div>

      {displayError && (
        <p role="alert" className="text-sm text-red-600">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
        aria-busy={loading}
      >
        {loading ? 'Looking up…' : 'Look up ISBN'}
      </button>
    </form>
  );
}
