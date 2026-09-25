"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Card grid skeleton shown while scholarship list data loads. */
export function ScholarshipCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-label="Loading scholarships"
      aria-busy="true"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-white p-6 space-y-4"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table row skeleton for list-based views (review queue, disbursements, etc.). */
export function TableRowsSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      aria-label="Loading data"
      aria-busy="true"
      className="space-y-3"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4" aria-hidden="true">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}
