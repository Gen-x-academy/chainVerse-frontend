"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ReadingListMetric = {
  label: string;
  value: number;
  unit?: "%" | "count";
};

export type AdoptionEntry = {
  courseId: string;
  courseName: string;
  enrolledCount: number;
  activeReaders: number;
  adoptionRate: number;
};

export type DemandEntry = {
  itemId: string;
  title: string;
  requestsCount: number;
  holdsCount: number;
  waitlistDepth: number;
};

export type AvailabilityGap = {
  itemId: string;
  title: string;
  required: boolean;
  available: boolean;
  reason?: string;
};

export type ReserveUsage = {
  itemId: string;
  title: string;
  totalReserves: number;
  activeReserves: number;
  avgReservationDurationDays: number;
};

export type EngagementMetric = {
  label: string;
  totalSessions: number;
  avgSessionMinutes: number;
  completionRate: number;
};

export interface CourseReadingListAnalyticsProps {
  courseId: string;
  courseName: string;
  isLoading?: boolean;
  error?: string | null;
  adoption?: AdoptionEntry[];
  demand?: DemandEntry[];
  availabilityGaps?: AvailabilityGap[];
  reserveUsage?: ReserveUsage[];
  engagement?: EngagementMetric[];
  periodLabel?: string;
  className?: string;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading analytics">
      <div className="h-4 w-48 rounded bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 rounded bg-muted" style={{ width: `${60 + i * 10}%` }} />
        ))}
      </div>
      <span className="sr-only">Loading course reading-list analytics...</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" role="status">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AdoptionTable({ entries }: { entries: AdoptionEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No adoption data available.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">List Adoption</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Reading list adoption by course">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4">Course</th>
              <th className="pb-2 pr-4 text-right">Enrolled</th>
              <th className="pb-2 pr-4 text-right">Active readers</th>
              <th className="pb-2 text-right">Adoption rate</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.courseId} className="border-t">
                <td className="py-2 pr-4 font-medium">{e.courseName}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.enrolledCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.activeReaders}</td>
                <td className="py-2 text-right tabular-nums">{e.adoptionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemandTable({ entries }: { entries: DemandEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No demand data available.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Item Demand</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Item demand metrics">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4 text-right">Requests</th>
              <th className="pb-2 pr-4 text-right">Holds</th>
              <th className="pb-2 text-right">Waitlist</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.itemId} className="border-t">
                <td className="py-2 pr-4 font-medium">{e.title}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.requestsCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.holdsCount}</td>
                <td className="py-2 text-right tabular-nums">{e.waitlistDepth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AvailabilityGapsList({ gaps }: { gaps: AvailabilityGap[] }) {
  if (gaps.length === 0) {
    return (
      <div className="rounded-md bg-green-50 p-3 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
        All required items are currently available.
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Availability Gaps</h4>
      <ul className="space-y-1" role="list" aria-label="Unavailable required items">
        {gaps.map((g) => (
          <li key={g.itemId} className="flex items-start justify-between rounded border border-red-200 bg-red-50 p-2 text-sm dark:border-red-900/50 dark:bg-red-950/20">
            <span className="font-medium">{g.title}</span>
            {g.reason && <span className="text-xs text-muted-foreground">{g.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReserveUsageTable({ entries }: { entries: ReserveUsage[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No reserve usage data.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Reserve Usage</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Reserve usage details">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4 text-right">Total</th>
              <th className="pb-2 pr-4 text-right">Active</th>
              <th className="pb-2 text-right">Avg days</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.itemId} className="border-t">
                <td className="py-2 pr-4 font-medium">{e.title}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.totalReserves}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{e.activeReserves}</td>
                <td className="py-2 text-right tabular-nums">{e.avgReservationDurationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EngagementSection({ metrics }: { metrics: EngagementMetric[] }) {
  if (metrics.length === 0) {
    return <p className="text-xs text-muted-foreground">No engagement data available.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Engagement</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{m.totalSessions}</p>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span>{m.avgSessionMinutes} min avg</span>
              <span>{m.completionRate}% completion</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CourseReadingListAnalytics({
  courseId,
  courseName,
  isLoading = false,
  error = null,
  adoption = [],
  demand = [],
  availabilityGaps = [],
  reserveUsage = [],
  engagement = [],
  periodLabel = "this period",
  className,
}: CourseReadingListAnalyticsProps) {
  if (isLoading) {
    return (
      <section className={cn("space-y-4", className)} aria-busy="true">
        <LoadingSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("space-y-4", className)} role="alert">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading analytics</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  const hasNoData =
    adoption.length === 0 &&
    demand.length === 0 &&
    availabilityGaps.length === 0 &&
    reserveUsage.length === 0 &&
    engagement.length === 0;

  if (hasNoData) {
    return (
      <section className={cn("space-y-4", className)}>
        <EmptyState message={`No reading-list analytics available for ${courseName} yet.`} />
      </section>
    );
  }

  return (
    <section className={cn("space-y-6", className)} aria-label={`Reading list analytics for ${courseName}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{courseName}</h3>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>

      <div className="space-y-6">
        <AdoptionTable entries={adoption} />
        <DemandTable entries={demand} />
        <AvailabilityGapsList gaps={availabilityGaps} />
        <ReserveUsageTable entries={reserveUsage} />
        <EngagementSection metrics={engagement} />
      </div>
    </section>
  );
}
