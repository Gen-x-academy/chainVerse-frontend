'use client';

import React from 'react';
import Link from 'next/link';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import { useLibrarianPermissions, useCanPerformLibrarianAction } from '@/src/features/library/hooks/useLibrarianPermissions';
import { useBookList } from '@/src/features/library/hooks/useBooks';
import { STATUS_LABELS } from '@/src/features/library/utils/book-lifecycle';

export default function LibraryCatalogPage() {
  const permissions = useLibrarianPermissions('admin');
  const canCreate = useCanPerformLibrarianAction(permissions, 'book.create');
  const { data, isLoading, error } = useBookList();

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref="/library/catalog"
      title="Catalog administration"
      description="Manage bibliographic records and holdings."
      allowed={permissions.includes('catalog')}
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {canCreate && (
          <Link
            href="/library/catalog/create"
            className="inline-flex justify-center px-4 py-2 text-sm bg-gray-900 text-white rounded-lg"
          >
            Create book record
          </Link>
        )}
        <Link
          href="/library/acquisitions/import"
          className="inline-flex justify-center px-4 py-2 text-sm border rounded-lg"
        >
          Import by ISBN
        </Link>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500" aria-label="Loading catalog">
          Loading catalog…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">No book records yet.</p>
      )}

      {data && data.data.length > 0 && (
        <ul className="divide-y border rounded-lg bg-white">
          {data.data.map((book) => (
            <li key={book.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">{book.bibliographic.title}</p>
                <p className="text-xs text-gray-500 capitalize">{STATUS_LABELS[book.status]}</p>
              </div>
              <Link
                href={`/library/catalog/${book.id}/edit`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LibrarianPageShell>
  );
}
