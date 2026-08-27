'use client';

import Link from 'next/link';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';

export default function LibraryPage() {
  return (
    <SectionContainer className="py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Library</h1>
      <p className="text-gray-600 mb-8">Browse the catalog, manage your account, or access staff tools.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/catalog"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
        >
          <h2 className="font-semibold text-gray-900">Catalog</h2>
          <p className="text-sm text-gray-500 mt-1">Search and discover books</p>
        </Link>
        <Link
          href="/library/account"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
        >
          <h2 className="font-semibold text-gray-900">My account</h2>
          <p className="text-sm text-gray-500 mt-1">Loans, holds, and fines</p>
        </Link>
        <Link
          href="/library/circulation"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
        >
          <h2 className="font-semibold text-gray-900">Circulation desk</h2>
          <p className="text-sm text-gray-500 mt-1">Staff checkout and returns</p>
        </Link>
        <Link
          href="/library/acquisitions"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
        >
          <h2 className="font-semibold text-gray-900">Acquisitions</h2>
          <p className="text-sm text-gray-500 mt-1">Donation intake workflow</p>
        </Link>
        <Link
          href="/library/reports/stocktake"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
        >
          <h2 className="font-semibold text-gray-900">Stocktake</h2>
          <p className="text-sm text-gray-500 mt-1">Guided inventory sessions</p>
        </Link>
      </div>
    </SectionContainer>
  );
}
