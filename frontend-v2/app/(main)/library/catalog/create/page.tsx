'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import { BookCreateForm } from '@/src/features/library/components/BookCreateForm';
import { useCreateBook } from '@/src/features/library/hooks/useBooks';
import {
  useLibrarianPermissions,
  useCanPerformLibrarianAction,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import { BookServiceError } from '@/src/features/library/services/book.service';
import type { BookCreatePayload } from '@/src/features/library/types/book.types';

export default function CreateBookPage() {
  const router = useRouter();
  const permissions = useLibrarianPermissions('admin');
  const canCreate = useCanPerformLibrarianAction(permissions, 'book.create');
  const createBook = useCreateBook();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (payload: BookCreatePayload) => {
    setFieldErrors({});
    setToast(null);
    try {
      const book = await createBook.mutateAsync(payload);
      setToast({ type: 'success', message: 'Book record created successfully.' });
      router.push(`/library/catalog/${book.id}/edit`);
    } catch (err) {
      if (err instanceof BookServiceError && err.code === 'validation' && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        setToast({ type: 'error', message: err.message });
        return;
      }
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create book record.',
      });
    }
  };

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref="/library/catalog"
      title="Create book record"
      description="Enter bibliographic metadata, contributors, taxonomy, holdings, and digital formats."
      allowed={canCreate}
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
        <BookCreateForm
          serverFieldErrors={fieldErrors}
          onSubmit={handleSubmit}
          loading={createBook.isPending}
        />
      </div>
    </LibrarianPageShell>
  );
}
