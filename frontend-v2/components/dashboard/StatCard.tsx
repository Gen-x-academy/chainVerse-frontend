"use client";

import React from "react";
import { cn } from "@/lib/utils"; // Assuming you have a standard class merger

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string; // e.g., "12%", "4.5k"
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div 
      className={cn(
        "bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col",
        className
      )}
    >
      {/* Header: Title and optional Icon */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 tracking-wide">
          {title}
        </h3>
        {icon && (
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-gray-400 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Body: Value and optional Trend badge */}
      <div className="flex items-baseline gap-3 mt-auto">
        <span className="text-2xl font-bold text-gray-900">
          {value}
        </span>
        
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              trend.isPositive
                ? "bg-green-50 text-green-700 border border-green-100"
                : "bg-red-50 text-red-700 border border-red-100"
            )}
          >
            {trend.isPositive ? "+" : "-"}{trend.value}
          </span>
        )}
      </div>
    </div>
  );
}