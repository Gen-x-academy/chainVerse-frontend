"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import { AnalyticsMetric, TrendDirection } from "@/src/components/dashboard/instructor/AnalyticsCard";
import { apiClient } from "@/src/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface State {
  metrics: AnalyticsMetric[];
  isLoading: boolean;
  error: string | null;
}

interface UseAnalyticsMetricsReturn extends State {
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAnalyticsMetrics
 *
 * Fetches instructor analytics metrics from the API.
 * Exposes metrics[], isLoading, error, and a refresh callback.
 *
 * Closes #747 — removed the FETCH_DELAY_MS / setTimeout demo placeholder.
 * The loading state is preserved and will reflect real network latency.
 */
export function useAnalyticsMetrics(): UseAnalyticsMetricsReturn {
  const [state, setState] = useState<State>({
    metrics: [],
    isLoading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const data = await apiClient.get<AnalyticsMetric[]>(
        "/course-analytics/instructor"
      );
      setState({ metrics: data, isLoading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: String(e),
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
