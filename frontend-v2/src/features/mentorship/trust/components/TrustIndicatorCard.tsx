'use client';

import { Gauge } from 'lucide-react';
import type { TrustIndicator } from '../types';

/** Card that explains a single computed trust indicator. */
export function TrustIndicatorCard({ indicator }: { indicator: TrustIndicator }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Gauge className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-gray-900 capitalize">{indicator.key}</h2>
      </header>
      <div className="space-y-4 p-6">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-gray-900">{indicator.score}</span>
          <span className="pb-1 text-sm text-gray-500">/ 100</span>
        </div>
        <p className="text-sm text-gray-700">{indicator.explanation}</p>
        {indicator.sparseData ? (
          <p className="text-xs text-amber-700">Sparse activity; treat with care.</p>
        ) : null}
        <p className="text-xs text-gray-500">
          Derived from {indicator.sourceIds.length} source record(s).
        </p>
      </div>
    </section>
  );
}
