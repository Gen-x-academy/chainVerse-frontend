'use client';

import Link from 'next/link';
import { LibrarianPageShell } from '@/src/features/library/components/LibrarianPageShell';
import {
  hasLibrarianPermission,
  useLibrarianPermissions,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import { useBookList } from '@/src/features/library/hooks/useBooks';
import { STATUS_LABELS } from '@/src/features/library/utils/book-lifecycle';
import {
  bookEditRoute,
  libraryCatalogRoute,
} from '@/src/features/library/utils/libraryRoutes';

export default function CatalogAdminPage() {
  const permissions = useLibrarianPermissions();
  const canCreate = hasLibrarianPermission(permissions, 'catalog');
  const { data, isLoading, error } = useBookList();

  return (
    <LibrarianPageShell
      permissions={permissions}
      activeHref={libraryCatalogRoute}
      title="Catalog administration"
      description="Manage bibliographic records and holdings."
      allowed={canCreate}
    >
      <div className="flex flex-col gap-3 mb-6 sm:flex-row">
        <Link
          href="/library/catalog/create"
          className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Create book record
        </Link>
        <Link
          href="/library/acquisitions/import"
          className="inline-flex justify-center rounded-lg border px-4 py-2 text-sm"
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
        <ul className="divide-y rounded-lg border bg-white">
          {data.data.map((book) => (
            <li
              key={book.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{book.bibliographic.title}</p>
                <p className="text-xs text-gray-500 capitalize">{STATUS_LABELS[book.status]}</p>
              </div>
              <Link
                href={bookEditRoute(book.id)}
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