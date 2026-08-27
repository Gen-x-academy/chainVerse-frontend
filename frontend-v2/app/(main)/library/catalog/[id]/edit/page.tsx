'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import { BookEditForm } from '@/src/features/library/components/BookEditForm';
import { BookConflictDialog } from '@/src/features/library/components/BookConflictDialog';
import {
  useBook,
  useUpdateBook,
  useBookStatusTransition,
} from '@/src/features/library/hooks/useBooks';
import {
  useLibrarianPermissions,
  useCanPerformLibrarianAction,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import { BookServiceError } from '@/src/features/library/services/book.service';
import type { Book, BookStatus, BookUpdatePayload } from '@/src/features/library/types/book.types';

export default function EditBookPage() {
  const params = useParams();
  const bookId = params.id as string;
  const permissions = useLibrarianPermissions('admin');
  const canEdit = useCanPerformLibrarianAction(permissions, 'book.edit');
  const canChangeStatus = useCanPerformLibrarianAction(permissions, 'book.status');

  const { data: book, isLoading, error, refetch } = useBook(bookId);
  const updateBook = useUpdateBook();
  const statusTransition = useBookStatusTransition();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [conflict, setConflict] = useState<Book | null>(null);
  const [comparing, setComparing] = useState(false);
  const [localTitle, setLocalTitle] = useState('');

  const handleSave = async (version: number, payload: BookUpdatePayload) => {
    setFieldErrors({});
    setToast(null);
    setLocalTitle(payload.bibliographic?.title ?? book?.bibliographic.title ?? '');
    try {
      await updateBook.mutateAsync({ id: bookId, version, payload });
      setToast({ type: 'success', message: 'Changes saved.' });
    } catch (err) {
      if (err instanceof BookServiceError && err.code === 'conflict' && err.conflict) {
        setConflict(err.conflict.serverRecord);
        setComparing(false);
        return;
      }
      if (err instanceof BookServiceError && err.code === 'validation' && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        setToast({ type: 'error', message: err.message });
        return;
      }
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save changes.',
      });
    }
  };

  const handleStatusChange = async (to: BookStatus) => {
    if (!book) return;
    setToast(null);
    try {
      await statusTransition.mutateAsync({ id: bookId, version: book.version, status: to });
      setToast({ type: 'success', message: `Status updated.` });
    } catch (err) {
      if (err instanceof BookServiceError && err.code === 'conflict' && err.conflict) {
        setConflict(err.conflict.serverRecord);
        return;
      }
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Status update failed.',
      });
    }
  };

  const reloadServerVersion = () => {
    setConflict(null);
    setComparing(false);
    void refetch();
  };

  if (isLoading) {
    return (
      <LibrarianPageShell
        permissions={permissions}
        activeHref="/library/catalog"
        title="Edit book record"
        allowed={canEdit}
      >
        <p aria-label="Loading book record">Loading…</p>
      </LibrarianPageShell>
    );
  }

  if (error || !book) {
    return (
      <LibrarianPageShell
        permissions={permissions}
        activeHref="/library/catalog"
        title="Edit book record"
        allowed={canEdit}
      >
        <p role="alert" className="text-red-600">
          {error ? (error as Error).message : 'Book not found.'}
        </p>
      </LibrarianPageShell>
    );
  }

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref="/library/catalog"
      title="Edit book record"
      description={book.bibliographic.title}
      allowed={canEdit}
    >
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 md:p-6">
        <BookEditForm
          key={`${book.id}-${book.version}`}
          book={book}
          serverFieldErrors={fieldErrors}
          onSave={handleSave}
          onStatusChange={handleStatusChange}
          canChangeStatus={canChangeStatus}
          loading={updateBook.isPending}
          statusLoading={statusTransition.isPending}
        />
      </div>

      {conflict && (
        <BookConflictDialog
          isOpen
          serverRecord={conflict}
          localTitle={localTitle}
          comparing={comparing}
          onReload={reloadServerVersion}
          onKeepEditing={() => {
            setConflict(null);
            setComparing(false);
          }}
          onCompare={() => setComparing(true)}
        />
      )}
    </LibrarianPageShell>
  );
}
