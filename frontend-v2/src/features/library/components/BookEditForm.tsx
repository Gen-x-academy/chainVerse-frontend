'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bibliographicSchema } from '../schemas/book.schema';
import { z } from 'zod';
import type { Book, BookUpdatePayload } from '../types/book.types';
import { BookStatusControls } from './BookStatusControls';
import { cn } from '@/lib/utils';

const editSchema = z.object({
  bibliographic: bibliographicSchema,
  coverUrl: z.string().url().optional().or(z.literal('')),
});

type EditFormValues = z.infer<typeof editSchema>;

export interface BookEditFormProps {
  book: Book;
  serverFieldErrors?: Record<string, string>;
  onSave: (version: number, payload: BookUpdatePayload) => void | Promise<void>;
  onStatusChange?: (newStatus: Book['status']) => void;
  canChangeStatus?: boolean;
  loading?: boolean;
  statusLoading?: boolean;
  className?: string;
}

export function BookEditForm({
  book,
  serverFieldErrors = {},
  onSave,
  onStatusChange,
  canChangeStatus = true,
  loading = false,
  statusLoading = false,
  className,
}: BookEditFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      bibliographic: book.bibliographic,
      coverUrl: book.coverUrl ?? '',
    },
  });

  const fieldError = (path: string) => {
    const parts = path.split('.');
    let err: unknown = errors;
    for (const p of parts) {
      err = (err as Record<string, unknown>)?.[p];
    }
    return serverFieldErrors[path] ?? (err as { message?: string })?.message;
  };

  const submit = handleSubmit(async (data) => {
    await onSave(book.version, {
      bibliographic: {
        ...data.bibliographic,
        subtitle: data.bibliographic.subtitle || undefined,
        isbn: data.bibliographic.isbn || undefined,
        isbn13: data.bibliographic.isbn13 || undefined,
        publisher: data.bibliographic.publisher || undefined,
      },
      coverUrl: data.coverUrl || undefined,
    });
  });

  return (
    <div className={cn('space-y-6', className)}>
      {canChangeStatus && onStatusChange && (
        <BookStatusControls
          status={book.status}
          version={book.version}
          onTransition={onStatusChange}
          loading={statusLoading}
        />
      )}

      <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        <input type="hidden" value={book.version} readOnly aria-hidden />

        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="edit-title"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            {...register('bibliographic.title')}
          />
          {fieldError('bibliographic.title') && (
            <p className="text-red-600 text-xs mt-1">{fieldError('bibliographic.title')}</p>
          )}
        </div>

        <div>
          <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="edit-description"
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            {...register('bibliographic.description')}
          />
          {fieldError('bibliographic.description') && (
            <p className="text-red-600 text-xs mt-1">{fieldError('bibliographic.description')}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-publisher" className="block text-sm font-medium text-gray-700 mb-1">
              Publisher
            </label>
            <input
              id="edit-publisher"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              {...register('bibliographic.publisher')}
            />
          </div>
          <div>
            <label htmlFor="edit-language" className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <input
              id="edit-language"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              {...register('bibliographic.language')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-cover" className="block text-sm font-medium text-gray-700 mb-1">
            Cover URL
          </label>
          <input
            id="edit-cover"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            {...register('coverUrl')}
          />
        </div>

        <p className="text-xs text-gray-400">Record version {book.version}</p>

        <button
          type="submit"
          disabled={loading || !isDirty}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
