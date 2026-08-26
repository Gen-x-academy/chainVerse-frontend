"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type RenewalBlockReason =
  | "max-renewals-reached"
  | "hold-pending"
  | "overdue-fines"
  | "policy-restriction"
  | "course-linked-limit";

export type RenewalState = {
  id: string;
  title: string;
  currentDueDate: string;
  newDueDatePreview?: string;
  renewalsUsed: number;
  maxRenewals: number;
  isOverdue: boolean;
  canRenew: boolean;
  blockReason?: RenewalBlockReason;
  blockMessage?: string;
};

export interface LoanRenewalControlsProps {
  loans: RenewalState[];
  isLoading?: boolean;
  error?: string | null;
  onRenew?: (loanId: string) => Promise<{ success: boolean; newDueDate?: string; error?: string }>;
  className?: string;
}

const BLOCK_REASON_LABEL: Record<RenewalBlockReason, string> = {
  "max-renewals-reached": "Maximum renewals reached",
  "hold-pending": "Item has a pending hold",
  "overdue-fines": "Outstanding overdue fines",
  "policy-restriction": "Policy restriction",
  "course-linked-limit": "Course-linked borrowing limit",
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading renewal controls">
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg border bg-muted" />
      ))}
      <span className="sr-only">Loading renewal controls...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" role="status">
      <p className="text-sm text-muted-foreground">No active loans to renew.</p>
    </div>
  );
}

function LoanRenewalCard({
  loan,
  onRenew,
}: {
  loan: RenewalState;
  onRenew?: (loanId: string) => Promise<{ success: boolean; newDueDate?: string; error?: string }>;
}) {
  const [status, setStatus] = useState<"idle" | "renewing" | "success" | "error">("idle");
  const [previewDueDate, setPreviewDueDate] = useState(loan.newDueDatePreview);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processingRef = useRef(false);

  const handleRenew = useCallback(async () => {
    if (processingRef.current || !onRenew || !loan.canRenew) return;
    processingRef.current = true;
    setStatus("renewing");
    setErrorMessage(null);

    try {
      const result = await onRenew(loan.id);
      if (result.success) {
        setStatus("success");
        if (result.newDueDate) {
          setPreviewDueDate(result.newDueDate);
        }
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? "Renewal failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Your original due date is unchanged.");
    } finally {
      processingRef.current = false;
    }
  }, [loan.canRenew, loan.id, onRenew]);

  const renewalsRemaining = loan.maxRenewals - loan.renewalsUsed;

  return (
    <div className="rounded-lg border p-4" data-loan-id={loan.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{loan.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span>
              Due: <time dateTime={loan.currentDueDate}>{loan.currentDueDate}</time>
            </span>
            <span>
              {loan.renewalsUsed}/{loan.maxRenewals} renewals used
            </span>
            {loan.isOverdue && (
              <span className="font-medium text-destructive">Overdue</span>
            )}
          </div>

          {previewDueDate && status === "idle" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Renewal would extend due date to:{" "}
              <time dateTime={previewDueDate} className="font-medium text-foreground">
                {previewDueDate}
              </time>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {loan.canRenew ? (
            <button
              type="button"
              onClick={handleRenew}
              disabled={status === "renewing"}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                status === "success"
                  ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {status === "renewing" && "Renewing..."}
              {status === "success" && "Renewed"}
              {status === "idle" && "Renew"}
              {status === "error" && "Retry"}
            </button>
          ) : (
            <span className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              Cannot renew
            </span>
          )}

          {renewalsRemaining > 0 && loan.canRenew && (
            <span className="text-xs text-muted-foreground">
              {renewalsRemaining} renewal{renewalsRemaining !== 1 ? "s" : ""} left
            </span>
          )}
        </div>
      </div>

      {!loan.canRenew && loan.blockReason && (
        <div className="mt-3 rounded-md bg-muted p-2 text-xs">
          <p className="font-medium">{BLOCK_REASON_LABEL[loan.blockReason]}</p>
          {loan.blockMessage && (
            <p className="mt-0.5 text-muted-foreground">{loan.blockMessage}</p>
          )}
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs dark:border-red-900/50 dark:bg-red-950/20" role="alert">
          <p className="text-red-700 dark:text-red-400">{errorMessage}</p>
          <p className="mt-1 text-muted-foreground">Your original due date ({loan.currentDueDate}) is unchanged.</p>
        </div>
      )}

      {status === "success" && previewDueDate && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs dark:border-green-900/50 dark:bg-green-950/20" role="status">
          <p className="text-green-700 dark:text-green-400">
            Successfully renewed. New due date:{" "}
            <time dateTime={previewDueDate}>{previewDueDate}</time>
          </p>
        </div>
      )}
    </div>
  );
}

export function LoanRenewalControls({
  loans,
  isLoading = false,
  error = null,
  onRenew,
  className,
}: LoanRenewalControlsProps) {
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
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading loans</p>
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

  return (
    <section className={cn("space-y-3", className)} aria-label="Loan renewal controls">
      {loans.map((loan) => (
        <LoanRenewalCard key={loan.id} loan={loan} onRenew={onRenew} />
      ))}
    </section>
  );
}
