'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import { ISBNLookupFlow } from '@/src/features/library/components/ISBNLookupFlow';
import { isbnService } from '@/src/features/library/services/isbn.service';
import { useCreateBook } from '@/src/features/library/hooks/useBooks';
import {
  useLibrarianPermissions,
  useCanPerformLibrarianAction,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import type { BookCreatePayload } from '@/src/features/library/types/book.types';

export default function ISBNImportPage() {
  const router = useRouter();
  const permissions = useLibrarianPermissions('admin');
  const canImport = useCanPerformLibrarianAction(permissions, 'book.isbn-import');
  const createBook = useCreateBook();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleImport = async (payload: BookCreatePayload) => {
    setToast(null);
    try {
      const draftPayload: BookCreatePayload = { ...payload, status: 'draft' };
      const book = await createBook.mutateAsync(draftPayload);
      setToast({ type: 'success', message: 'Imported record saved as draft.' });
      router.push(`/library/catalog/${book.id}/edit`);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Import failed.',
      });
    }
  };

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref="/library/acquisitions"
      title="Import by ISBN"
      description="Look up external metadata, review provenance, and save as a draft record."
      allowed={canImport}
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

      <div className="bg-white rounded-xl border p-4 md:p-6 max-w-2xl">
        <ISBNLookupFlow
          loading={lookupLoading}
          importLoading={createBook.isPending}
          onLookup={async (isbn) => {
            setLookupLoading(true);
            try {
              return await isbnService.lookup(isbn);
            } finally {
              setLookupLoading(false);
            }
          }}
          onImport={handleImport}
        />
      </div>
    </LibrarianPageShell>
  );
}
