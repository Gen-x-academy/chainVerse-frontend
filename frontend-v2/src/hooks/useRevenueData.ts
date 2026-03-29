"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenuePeriod = "6M" | "1Y" | "2Y";

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  enrollments: number;
}

export interface RevenueSummary {
  total: number;
  growth: number;     // percentage vs previous period
  avgMonthly: number;
  peakMonth: string;
}

export interface RevenueChartData {
  points: RevenueDataPoint[];
  summary: RevenueSummary;
}

interface UseRevenueDataReturn {
  data: RevenueChartData | null;
  isLoading: boolean;
  error: string | null;
  period: RevenuePeriod;
  setPeriod: (p: RevenuePeriod) => void;
  refresh: () => void;
}

// ─── Mock data by period ──────────────────────────────────────────────────────
// Shape matches what a real API would return; swap fetchData() body for a real call.

const MOCK_DATA: Record<RevenuePeriod, RevenueChartData> = {
  "6M": {
    points: [
      { month: "Sep", revenue: 620,  enrollments: 14 },
      { month: "Oct", revenue: 780,  enrollments: 18 },
      { month: "Nov", revenue: 950,  enrollments: 23 },
      { month: "Dec", revenue: 870,  enrollments: 20 },
      { month: "Jan", revenue: 1100, enrollments: 28 },
      { month: "Feb", revenue: 1240, enrollments: 31 },
    ],
    summary: { total: 5560, growth: 17.8, avgMonthly: 926, peakMonth: "Feb" },
  },
  "1Y": {
    points: [
      { month: "Mar", revenue: 420,  enrollments: 10 },
      { month: "Apr", revenue: 510,  enrollments: 12 },
      { month: "May", revenue: 580,  enrollments: 13 },
      { month: "Jun", revenue: 640,  enrollments: 15 },
      { month: "Jul", revenue: 590,  enrollments: 14 },
      { month: "Aug", revenue: 670,  enrollments: 16 },
      { month: "Sep", revenue: 620,  enrollments: 14 },
      { month: "Oct", revenue: 780,  enrollments: 18 },
      { month: "Nov", revenue: 950,  enrollments: 23 },
      { month: "Dec", revenue: 870,  enrollments: 20 },
      { month: "Jan", revenue: 1100, enrollments: 28 },
      { month: "Feb", revenue: 1240, enrollments: 31 },
    ],
    summary: { total: 8970, growth: 24.3, avgMonthly: 748, peakMonth: "Feb" },
  },
  "2Y": {
    points: [
      { month: "Mar'24", revenue: 200,  enrollments: 5  },
      { month: "Jun'24", revenue: 340,  enrollments: 8  },
      { month: "Sep'24", revenue: 420,  enrollments: 10 },
      { month: "Dec'24", revenue: 510,  enrollments: 12 },
      { month: "Mar'25", revenue: 620,  enrollments: 15 },
      { month: "Jun'25", revenue: 780,  enrollments: 20 },
      { month: "Sep'25", revenue: 870,  enrollments: 22 },
      { month: "Dec'25", revenue: 1100, enrollments: 28 },
    ],
    summary: { total: 4840, growth: 450, avgMonthly: 605, peakMonth: "Dec'25" },
  },
};

const FETCH_DELAY_MS = 900;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useRevenueData
 *
 * Manages period selection and simulates async revenue data fetching.
 * Swapping the mock for a real endpoint only requires editing fetchData().
 *
 * Time:  O(1) per period switch (hash-map lookup into MOCK_DATA).
 * Space: O(n) — n data points for the selected period (≤ 12, O(1) in practice).
 */
export function useRevenueData(): UseRevenueDataReturn {
  const [period, setPeriodState] = useState<RevenuePeriod>("6M");
  const [data, setData] = useState<RevenueChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (selectedPeriod: RevenuePeriod) => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace with: const result = await apiClient.get(`/instructor/revenue?period=${selectedPeriod}`);
      await new Promise<void>((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
      setData(MOCK_DATA[selectedPeriod]);
    } catch {
      setError("Failed to load revenue data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData(period);
  }, [fetchData, period]);

  const setPeriod = useCallback((p: RevenuePeriod) => {
    setPeriodState(p);
    // period change triggers useEffect above — no duplicate call needed
  }, []);

  const refresh = useCallback(() => fetchData(period), [fetchData, period]);

  return { data, isLoading, error, period, setPeriod, refresh };
}
