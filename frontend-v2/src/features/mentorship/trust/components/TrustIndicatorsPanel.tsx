'use client';

import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useTrustStore } from './store';
import { TrustIndicatorCard } from './TrustIndicatorCard';
import type { StudentTrustProfile } from '../types';

/**
 * Trust dashboard for the signed-in student.
 *
 * The indicators are computed locally until the mentorship API is available,
 * and they are never self-awarded: there is no write path for them.
 */
export function TrustIndicatorsPanel() {
  const state = useTrustStore();
  const profile = state.profile;
  const status = state.status;
  const error = state.error;
  const compute = state.compute;

  useEffect(() => {
    void compute();
    // Run once per mount; recomputation is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trustProfile: StudentTrustProfile | null = profile;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">Trust indicators</h2>
      </header>
      <div className="p-6">
        {error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : status === 'loading' ? (
          <p className="text-sm text-gray-500">Computing trust indicators...</p>
        ) : trustProfile === null ? (
          <p className="text-sm text-gray-500">No trust profile yet.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <TrustIndicatorCard indicator={trustProfile.completion} />
            <TrustIndicatorCard indicator={trustProfile.verification} />
            <TrustIndicatorCard indicator={trustProfile.response} />
            <TrustIndicatorCard indicator={trustProfile.delivery} />
            <TrustIndicatorCard indicator={trustProfile.safety} />
          </div>
        )}
      </div>
    </section>
  );
}
