'use client';

import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';

export default function CatalogAdminPage() {
  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage catalog records, imports, exports, and duplicate resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/library/catalog/duplicates"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Duplicate records</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compare and merge suspected duplicate catalog entries.
            </p>
          </Link>
          <Link
            href="/library/catalog/import"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Bulk import</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload CSV or JSON with validation and row-level error reporting.
            </p>
          </Link>
          <Link
            href="/library/catalog/export"
            className="rounded-lg border bg-white p-6 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-gray-900">Bulk export</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Export filtered catalog metadata and holdings.
            </p>
          </Link>
        </div>
      </div>
    </LibraryAdminLayout>
  );
}
