'use client';

import React, { useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { ArchivedBookStatus } from './ArchivedBookStatus';
import { useArchivedBooks, useRestoreBook } from '../hooks/useArchivedBooks';
import type { ArchivedBook } from '../types/archive.types';

export interface RestoreBookDialogProps {
  book: ArchivedBook;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function RestoreBookDialog({ book, open, onClose, onRestored }: RestoreBookDialogProps) {
  const restore = useRestoreBook();

  if (!open) return null;

  const handleRestore = async () => {
    try {
      await restore.mutateAsync(book.id);
      onRestored();
      onClose();
    } catch {
      // Error surfaced via restore.isError below
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 id="restore-dialog-title" className="text-lg font-semibold text-gray-900">
          Restore &ldquo;{book.title}&rdquo;?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          This will return the book to active catalog discovery. Patrons will be able to find and
          borrow it again. The archive record is preserved in audit history.
        </p>
        {restore.isError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {restore.error instanceof Error ? restore.error.message : 'Restore failed. Try again.'}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={restore.isPending}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restore.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {restore.isPending ? 'Restoring…' : 'Restore to catalog'}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ArchivedBooksPanelProps {
  /** When false, patron-facing views must not see restore controls. */
  isLibrarian?: boolean;
}

export function ArchivedBooksPanel({ isLibrarian = false }: ArchivedBooksPanelProps) {
  const [page, setPage] = useState(1);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedBook | null>(null);
  const { data, isLoading, isError, error, isFetching } = useArchivedBooks(page);
  const restore = useRestoreBook();

  if (!isLibrarian) {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <p className="font-medium">Access restricted</p>
        <p className="mt-1 text-sm">Archived catalog management is available to librarians only.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading archived books" className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load archived books</p>
        <p className="mt-1 text-sm">
          {error instanceof Error ? error.message : 'Please try again.'}
        </p>
      </div>
    );
  }

  const books = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.limit ?? 20)));

  return (
    <section aria-labelledby="archived-books-heading">
      <div className="mb-4 flex items-center gap-2">
        <Archive className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h2 id="archived-books-heading" className="text-lg font-semibold text-gray-900">
          Archived Catalog
        </h2>
        <span className="text-sm text-gray-500">
          {total} archived {total === 1 ? 'title' : 'titles'}
          {isFetching ? ' (refreshing…)' : ''}
        </span>
      </div>

      {books.length === 0 ? (
        <p className="py-8 text-center text-gray-500" role="status">
          No archived books. Titles removed from discovery appear here.
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {books.map((book) => (
            <li
              key={book.id}
              className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    className="h-16 w-12 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                    No cover
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <ArchivedBookStatus
                    status={book.status}
                    title={book.title}
                    archivedAt={book.archivedAt}
                    archiveReason={book.archiveReason}
                  />
                  <p className="mt-1 text-xs text-gray-500">by {book.authorName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(book)}
                disabled={restore.isPending}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 sm:self-center"
                aria-label={`Restore ${book.title} to catalog`}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex justify-center gap-2" aria-label="Archived books pagination">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}

      {restoreTarget && (
        <RestoreBookDialog
          book={restoreTarget}
          open
          onClose={() => setRestoreTarget(null)}
          onRestored={() => setRestoreTarget(null)}
        />
      )}
    </section>
  );
}
