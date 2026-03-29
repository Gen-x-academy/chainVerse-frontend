"use client";

import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { AnalyticsCard, type AnalyticsMetric } from "./AnalyticsCard";
import { useAnalyticsMetrics } from "@/src/hooks/useAnalyticsMetrics";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Matches the number of real metrics so skeleton layout never shifts. */
const SKELETON_COUNT = 4;

/** Empty shell metric — only rendered when isLoading=true (values are never read). */
const SKELETON_METRIC = {} as AnalyticsMetric;

// ─── Error Banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="col-span-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700"
  >
    <AlertCircle size={18} className="flex-shrink-0" aria-hidden="true" />
    <p className="text-sm font-medium flex-1">{message}</p>
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors"
    >
      <RefreshCw size={12} aria-hidden="true" />
      Retry
    </button>
  </div>
);

// ─── Grid ─────────────────────────────────────────────────────────────────────

/**
 * AnalyticsGrid
 *
 * Renders a responsive 1→2→4 column grid of analytics metric cards.
 * Delegates all data concerns to `useAnalyticsMetrics` — this component
 * is purely presentational layout + state display.
 *
 * Time:  O(n) render sweep, n = metrics.length (fixed at 4 → O(1) in practice).
 * Space: O(n) DOM nodes proportional to metric count.
 */
export const AnalyticsGrid: React.FC = () => {
  const { metrics, isLoading, error, refresh } = useAnalyticsMetrics();

  return (
    <section aria-label="Overview analytics" className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* ── Error state ── */}
        {error && <ErrorBanner message={error} onRetry={refresh} />}

        {/* ── Loading skeletons ── */}
        {isLoading &&
          Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <AnalyticsCard
              key={`skeleton-${i}`}
              metric={SKELETON_METRIC}
              isLoading
            />
          ))}

        {/* ── Resolved metrics ── */}
        {!isLoading &&
          !error &&
          metrics.map((metric) => (
            <AnalyticsCard key={metric.id} metric={metric} />
          ))}
      </div>
    </section>
  );
};
