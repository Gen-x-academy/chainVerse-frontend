"use client";

import React, { ComponentType } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendDirection = "up" | "down" | "neutral";

export interface AnalyticsMetric {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: TrendDirection;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  description?: string;
}

interface AnalyticsCardProps {
  metric: AnalyticsMetric;
  isLoading?: boolean;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const AnalyticsCardSkeleton: React.FC = () => (
  <div
    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse"
    role="status"
    aria-label="Loading metric"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 w-28 bg-gray-200 rounded-full" />
      <div className="w-10 h-10 rounded-xl bg-gray-100" />
    </div>
    <div className="h-8 w-24 bg-gray-200 rounded-full mb-2" />
    <div className="h-3 w-36 bg-gray-100 rounded-full" />
  </div>
);

// ─── Trend Badge ──────────────────────────────────────────────────────────────

const TREND_STYLES: Record<TrendDirection, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-rose-600 bg-rose-50",
  neutral: "text-gray-500 bg-gray-100",
};

const TrendBadge: React.FC<{ change: string; trend: TrendDirection }> = ({
  change,
  trend,
}) => {
  const Icon = trend === "down" ? TrendingDown : TrendingUp;
  const showIcon = trend !== "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
        TREND_STYLES[trend]
      )}
    >
      {showIcon && <Icon size={11} aria-hidden="true" />}
      {change}
    </span>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  metric,
  isLoading = false,
}) => {
  if (isLoading) return <AnalyticsCardSkeleton />;

  const { title, value, change, trend, icon: Icon, iconBg, iconColor, description } = metric;

  return (
    <article
      className={cn(
        "group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm",
        "hover:shadow-lg hover:border-indigo-100 transition-all duration-300",
        "hover:-translate-y-0.5"
      )}
      aria-label={`${title}: ${value}`}
    >
      {/* Subtle gradient glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-50/0 to-indigo-100/0 group-hover:from-indigo-50/30 group-hover:to-purple-50/20 transition-all duration-500 pointer-events-none"
        aria-hidden="true"
      />

      {/* Header row */}
      <div className="relative flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 leading-none">{title}</p>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            "transition-transform duration-300 group-hover:scale-110",
            iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
        </div>
      </div>

      {/* Value */}
      <div className="relative mb-2">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">
          {value}
        </span>
      </div>

      {/* Trend + description */}
      <div className="relative flex items-center gap-2 flex-wrap">
        <TrendBadge change={change} trend={trend} />
        {description && (
          <span className="text-xs text-gray-400">{description}</span>
        )}
      </div>
    </article>
  );
};
