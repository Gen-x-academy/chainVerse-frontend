"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevenueData, RevenuePeriod, RevenueDataPoint } from "@/src/hooks/useRevenueData";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: RevenuePeriod }[] = [
  { label: "6M", value: "6M" },
  { label: "1 Year", value: "1Y" },
  { label: "2 Years", value: "2Y" },
];

// Recharts gradient IDs must be unique per chart instance
const GRADIENT_ID = "revenueGradient";
const STROKE_COLOR = "#4f46e5";   // indigo-600
const FILL_COLOR   = "#4f46e5";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) return null;
  const revenue     = payload[0]?.value ?? 0;
  const enrollments = payload[1]?.value ?? 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Revenue</span>
          <span className="font-bold text-indigo-600">{revenue.toLocaleString()} XLM</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Enrollments</span>
          <span className="font-bold text-emerald-600">{enrollments}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const RevenueChartSkeleton: React.FC = () => (
  <div className="animate-pulse" role="status" aria-label="Loading revenue chart">
    {/* Stat row */}
    <div className="flex gap-6 mb-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex-1 space-y-2">
          <div className="h-3 w-20 bg-gray-200 rounded-full" />
          <div className="h-7 w-28 bg-gray-300 rounded-full" />
          <div className="h-3 w-16 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
    {/* Chart area */}
    <div className="h-64 bg-gradient-to-b from-gray-100 to-gray-50 rounded-2xl" />
  </div>
);

// ─── Summary Stat ─────────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const Stat: React.FC<StatProps> = ({ label, value, sub, highlight }) => (
  <div className="flex-1 min-w-0">
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
    <p className={cn("text-xl font-bold tracking-tight", highlight ? "text-indigo-600" : "text-gray-900")}>
      {value}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// ─── Period Pill ──────────────────────────────────────────────────────────────

interface PeriodPillProps {
  label: string;
  value: RevenuePeriod;
  active: boolean;
  onClick: () => void;
}

const PeriodPill: React.FC<PeriodPillProps> = ({ label, value, active, onClick }) => (
  <button
    id={`revenue-period-${value}`}
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
      active
        ? "bg-indigo-600 text-white shadow-sm"
        : "text-gray-500 hover:bg-gray-100"
    )}
    aria-pressed={active}
    aria-label={`Show ${label} revenue data`}
  >
    {label}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * RevenueChart
 *
 * Production-grade revenue analytics chart for the instructor dashboard.
 *
 * Features:
 * - Area chart with gradient fill (Recharts AreaChart)
 * - Period selector (6M / 1Y / 2Y) with O(1) data lookup
 * - Custom branded tooltip showing revenue (XLM) + enrollments
 * - Summary stat row: total revenue, MoM growth, avg monthly, peak month
 * - Animated loading skeleton while data fetches
 * - Error banner with retry callback
 *
 * Time:  O(n) render over data points (n ≤ 12 → O(1) in practice).
 * Space: O(n) chart nodes — proportional to period data size.
 */
export const RevenueChart: React.FC = () => {
  const { data, isLoading, error, period, setPeriod, refresh } = useRevenueData();

  // Derive chart-safe data — memoized so Recharts only re-renders on data change
  const chartPoints: RevenueDataPoint[] = useMemo(
    () => data?.points ?? [],
    [data]
  );

  const growthPositive = (data?.summary.growth ?? 0) >= 0;
  const GrowthIcon = growthPositive ? TrendingUp : TrendingDown;

  return (
    <section
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
      aria-label="Revenue analytics chart"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-gray-900 leading-tight">
            Revenue Overview
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Earnings in XLM · Instructor dashboard</p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
          {PERIODS.map(({ label, value }) => (
            <PeriodPill
              key={value}
              label={label}
              value={value}
              active={period === value}
              onClick={() => setPeriod(value)}
            />
          ))}
        </div>
      </div>

      {/* ── Error State ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 mb-4 text-sm"
        >
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1 font-medium">{error}</span>
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {/* ── Content: skeleton or chart ── */}
      {isLoading ? (
        <RevenueChartSkeleton />
      ) : (
        data && (
          <>
            {/* ── Summary Stats ── */}
            <div className="flex gap-6 mb-6 flex-wrap border-b border-gray-50 pb-5">
              <Stat
                label="Total Revenue"
                value={`${data.summary.total.toLocaleString()} XLM`}
                highlight
              />
              <Stat
                label="Growth"
                value={`${growthPositive ? "+" : ""}${data.summary.growth}%`}
                sub="vs. previous period"
              />
              <Stat
                label="Avg / Month"
                value={`${data.summary.avgMonthly.toLocaleString()} XLM`}
              />
              <Stat
                label="Peak Month"
                value={data.summary.peakMonth}
              />
              {/* Inline growth badge */}
              <div className="flex items-center self-center ml-auto">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full",
                    growthPositive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  )}
                >
                  <GrowthIcon size={12} aria-hidden="true" />
                  {growthPositive ? "+" : ""}{data.summary.growth}% this period
                </span>
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartPoints}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  {/* Gradient fill definition */}
                  <defs>
                    <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={FILL_COLOR} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={FILL_COLOR} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}`}
                    width={48}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "#e0e7ff", strokeWidth: 2 }}
                  />

                  {/* Hidden enrollments series — surfaced only in tooltip */}
                  <Area
                    type="monotone"
                    dataKey="enrollments"
                    stroke="transparent"
                    fill="transparent"
                    legendType="none"
                  />

                  {/* Primary revenue area */}
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={STROKE_COLOR}
                    strokeWidth={2.5}
                    fill={`url(#${GRADIENT_ID})`}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: STROKE_COLOR,
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      )}
    </section>
  );
};
