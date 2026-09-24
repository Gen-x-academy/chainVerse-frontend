import Link from 'next/link';
import { Library } from 'lucide-react';

export default function CatalogNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center" role="alert">
        <Library className="mx-auto mb-4 h-12 w-12 text-gray-300" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Book not found</h1>
        <p className="mt-2 text-gray-600">
          This title is not available in the library catalog, or the link you
          followed points to a record that no longer exists.
        </p>
        <Link
          href="/catalog/search"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Back to catalog search
        </Link>
      </div>
    </div>
  );
}