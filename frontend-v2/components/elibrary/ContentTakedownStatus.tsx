"use client";

import { cn } from "@/lib/utils";

export type TakedownState = "requested" | "under_review" | "removed" | "restored";

interface ContentTakedownStatusProps {
  state: TakedownState;
  title: string;
  isLibrarian?: boolean;
  reviewNote?: string;
  className?: string;
}

const STATE_COPY: Record<TakedownState, { label: string; tone: string }> = {
  requested: { label: "Takedown requested", tone: "bg-slate-100 text-slate-800" },
  under_review: { label: "Under review", tone: "bg-amber-100 text-amber-900" },
  removed: { label: "Removed", tone: "bg-red-100 text-red-800" },
  restored: { label: "Restored", tone: "bg-emerald-100 text-emerald-800" },
};

/** Fix #987: patron/librarian-facing content takedown state, avoids leaking legal detail to patrons. */
export function ContentTakedownStatus({
  state,
  title,
  isLibrarian = false,
  reviewNote,
  className,
}: ContentTakedownStatusProps) {
  const { label, tone } = STATE_COPY[state];

  return (
    <div className={cn("rounded-md border p-3 text-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{title}</span>
        <span className={cn("rounded px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>
      </div>
      {state === "removed" && (
        <p className="mt-1 text-xs text-muted-foreground">
          This item is no longer available for access.
        </p>
      )}
      {isLibrarian && reviewNote && (
        <p className="mt-2 text-xs text-muted-foreground">Review trail: {reviewNote}</p>
      )}
    </div>
  );
}
