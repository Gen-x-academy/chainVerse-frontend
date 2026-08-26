"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type EscalationLevel = "none" | "gentle" | "warning" | "critical";

export type OverdueLoan = {
  id: string;
  title: string;
  dueDate: string;
  daysOverdue: number;
  escalationLevel: EscalationLevel;
  accountSummary?: {
    totalOverdueItems: number;
    totalFinesCents: number;
    accountStatus: "active" | "restricted" | "suspended";
  };
};

export interface OverdueEscalationViewProps {
  loans: OverdueLoan[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

const ESCALATION_STYLES: Record<EscalationLevel, string> = {
  none: "",
  gentle: "border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
  warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  critical: "border-l-red-600 bg-red-50 dark:bg-red-950/20",
};

const ESCALATION_MESSAGE: Record<EscalationLevel, string> = {
  none: "",
  gentle: "This item is due back soon. Please return or renew to avoid overdue status.",
  warning: "This item is overdue. Additional charges may apply if not returned promptly.",
  critical: "This item is significantly overdue. Your borrowing privileges may be affected.",
};

function OverdueBanner({ loan }: { loan: OverdueLoan }) {
  const levelLabel: Record<EscalationLevel, string> = {
    none: "",
    gentle: "Reminder",
    warning: "Overdue",
    critical: "Urgent",
  };

  return (
    <div
      className={cn(
        "rounded-md border-l-4 p-3",
        ESCALATION_STYLES[loan.escalationLevel],
        loan.escalationLevel === "none" && "border-l-gray-300 bg-gray-50 dark:bg-gray-900/20"
      )}
      role="status"
      aria-label={`Overdue: ${loan.title}, ${loan.daysOverdue} day${loan.daysOverdue !== 1 ? "s" : ""} overdue`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {loan.escalationLevel !== "none" && (
              <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium dark:bg-black/20">
                {levelLabel[loan.escalationLevel]}
              </span>
            )}
            <p className="truncate text-sm font-medium">{loan.title}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
            <span>
              Due: <time dateTime={loan.dueDate}>{loan.dueDate}</time>
            </span>
            <span>
              <strong className="text-foreground">{loan.daysOverdue}</strong> day
              {loan.daysOverdue !== 1 ? "s" : ""} overdue
            </span>
          </div>
        </div>
      </div>

      {loan.escalationLevel !== "none" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {ESCALATION_MESSAGE[loan.escalationLevel]}
        </p>
      )}
    </div>
  );
}

function AccountSummaryBar({ summary }: { summary: NonNullable<OverdueLoan["accountSummary"]> }) {
  const statusColors: Record<string, string> = {
    active: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/20",
    restricted: "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/20",
    suspended: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/20",
  };

  return (
    <div
      className={cn("rounded-md p-3 text-sm", statusColors[summary.accountStatus] ?? statusColors.active)}
      aria-label={`Account status: ${summary.accountStatus}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-medium capitalize">{summary.accountStatus}</span>
        <span className="text-xs text-muted-foreground">
          {summary.totalOverdueItems} overdue item{summary.totalOverdueItems !== 1 ? "s" : ""}
        </span>
        {summary.totalFinesCents > 0 && (
          <span className="text-xs text-muted-foreground">
            ${" "}
            {(summary.totalFinesCents / 100).toFixed(2)} in outstanding fines
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading overdue status">
      {[1, 2].map((i) => (
        <div key={i} className="h-20 rounded-md border-l-4 border-l-gray-200 bg-muted" />
      ))}
      <span className="sr-only">Loading overdue status...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-green-200 bg-green-50/50 p-8 text-center dark:border-green-900/30 dark:bg-green-950/10">
      <p className="text-sm font-medium text-green-700 dark:text-green-400">All items are on track</p>
      <p className="mt-1 text-xs text-muted-foreground">You have no overdue items.</p>
    </div>
  );
}

export function OverdueEscalationView({
  loans,
  isLoading = false,
  error = null,
  className,
}: OverdueEscalationViewProps) {
  if (isLoading) {
    return (
      <section className={cn("space-y-3", className)} aria-busy="true">
        <LoadingSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("space-y-3", className)} role="alert">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading overdue status</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  if (loans.length === 0) {
    return (
      <section className={cn("space-y-3", className)}>
        <EmptyState />
      </section>
    );
  }

  const firstSummary = loans[0]?.accountSummary;

  return (
    <section className={cn("space-y-4", className)} aria-label="Overdue items and escalation status">
      {firstSummary && <AccountSummaryBar summary={firstSummary} />}

      <div className="space-y-2">
        {loans.map((loan) => (
          <OverdueBanner key={loan.id} loan={loan} />
        ))}
      </div>
    </section>
  );
}
