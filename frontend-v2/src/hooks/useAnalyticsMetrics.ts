"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import { AnalyticsMetric, TrendDirection } from "@/src/components/dashboard/instructor/AnalyticsCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseAnalyticsMetricsReturn {
  metrics: AnalyticsMetric[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// ─── Static metric definitions (structure, O(1) lookup) ───────────────────────

/**
 * In a real app this would call an API. We simulate async fetch
 * to exercise the loading state per the acceptance criteria.
 * The shape is typed and could be swapped for an API response 1:1.
 */
const METRICS_DATA: AnalyticsMetric[] = [
  {
    id: "total-students",
    title: "Total Students",
    value: "1,284",
    change: "+12.5%",
    trend: "up" as TrendDirection,
    icon: Users,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    description: "since last month",
  },
  {
    id: "active-courses",
    title: "Active Courses",
    value: "12",
    change: "+2",
    trend: "up" as TrendDirection,
    icon: BookOpen,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    description: "vs. last month",
  },
  {
    id: "total-hours",
    title: "Total Hours Taught",
    value: "456h",
    change: "+48h",
    trend: "up" as TrendDirection,
    icon: Clock,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    description: "this month",
  },
  {
    id: "earnings",
    title: "Earnings",
    value: "2,450 XLM",
    change: "+18%",
    trend: "up" as TrendDirection,
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    description: "since last month",
  },
];

const FETCH_DELAY_MS = 0; // removed artificial delay — real network latency is sufficient

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAnalyticsMetrics
 *
 * Fetches (or simulates fetching) instructor analytics metrics.
 * Exposes metrics[], isLoading, error, and a refresh callback.
 *
 * Time complexity:  O(n) for the initial data resolve, O(1) for re-renders.
 * Space complexity: O(n) — holds n metric objects (n=4, effectively O(1)).
 */
export function useAnalyticsMetrics(): UseAnalyticsMetricsReturn {
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace this with a real API call:
      // const data = await apiClient.get<AnalyticsMetric[]>("/instructor/metrics");
      setMetrics(METRICS_DATA);
    } catch {
      setError("Failed to load metrics. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, error, refresh: fetchMetrics };
}
