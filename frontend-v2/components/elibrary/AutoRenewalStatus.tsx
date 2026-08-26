"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export type AutoRenewalOutcome = "success" | "failed" | "ineligible";

export type LoanAutoRenewal = {
  id: string;
  title: string;
  eligible: boolean;
  enabled: boolean;
  nextEvaluationDate: string;
  currentDueDate: string;
  renewalsUsed: number;
  maxRenewals: number;
  lastOutcome?: AutoRenewalOutcome;
  lastFailureReason?: string;
};

export type AutoRenewalPreferences = {
  enabled: boolean;
  notifyBeforeRenewal: boolean;
  notifyOnFailure: boolean;
};

export interface AutoRenewalStatusProps {
  loans: LoanAutoRenewal[];
  preferences: AutoRenewalPreferences;
  isLoading?: boolean;
  error?: string | null;
  scope: "loan" | "account";
  onToggleLoan?: (loanId: string, enabled: boolean) => void;
  onUpdatePreferences?: (prefs: AutoRenewalPreferences) => void;
  className?: string;
}

const OUTCOME_STYLES: Record<AutoRenewalOutcome, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  ineligible: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const OUTCOME_LABEL: Record<AutoRenewalOutcome, string> = {
  success: "Renewed",
  failed: "Failed",
  ineligible: "Not eligible",
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading auto-renewal status">
      <div className="h-10 w-48 rounded bg-muted" />
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg border bg-muted" />
      ))}
      <span className="sr-only">Loading auto-renewal status...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" role="status">
      <p className="text-sm text-muted-foreground">No loans to manage auto-renewal for.</p>
    </div>
  );
}

function LoanRenewalCard({
  loan,
  onToggle,
}: {
  loan: LoanAutoRenewal;
  onToggle?: (loanId: string, enabled: boolean) => void;
}) {
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
              Next eval: <time dateTime={loan.nextEvaluationDate}>{loan.nextEvaluationDate}</time>
            </span>
            <span>
              {loan.renewalsUsed}/{loan.maxRenewals} renewals used
            </span>
          </div>
        </div>

        {onToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={loan.enabled}
            aria-label={`Auto-renewal for ${loan.title}`}
            disabled={!loan.eligible}
            onClick={() => onToggle(loan.id, !loan.enabled)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
              loan.enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform",
                loan.enabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        )}
      </div>

      {!loan.eligible && (
        <p className="mt-2 text-xs text-muted-foreground">
          Auto-renewal is not available for this item (policy restriction or maximum renewals reached).
        </p>
      )}

      {renewalsRemaining === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Maximum renewals reached. No further auto-renewals will be attempted.
        </p>
      )}

      {loan.lastOutcome && (
        <div className="mt-2 flex items-center gap-2">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", OUTCOME_STYLES[loan.lastOutcome])}>
            {OUTCOME_LABEL[loan.lastOutcome]}
          </span>
          {loan.lastOutcome === "failed" && loan.lastFailureReason && (
            <span className="text-xs text-muted-foreground">{loan.lastFailureReason}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PreferencesPanel({
  preferences,
  scope,
  onUpdate,
}: {
  preferences: AutoRenewalPreferences;
  scope: "loan" | "account";
  onUpdate?: (prefs: AutoRenewalPreferences) => void;
}) {
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const update = (patch: Partial<AutoRenewalPreferences>) => {
    setLocalPrefs((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaveStatus("saving");
    try {
      onUpdate(localPrefs);
      setSaveStatus("saved");
      setDirty(false);
    } catch {
      setSaveStatus("error");
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h4 className="text-sm font-medium">
        Auto-Renewal Settings
        {scope === "account" && (
          <span className="ml-2 text-xs text-muted-foreground">(applies to all loans)</span>
        )}
      </h4>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={localPrefs.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
        Enable auto-renewal
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={localPrefs.notifyBeforeRenewal}
          onChange={(e) => update({ notifyBeforeRenewal: e.target.checked })}
          disabled={!localPrefs.enabled}
          className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
        />
        Notify before each renewal
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={localPrefs.notifyOnFailure}
          onChange={(e) => update({ notifyOnFailure: e.target.checked })}
          disabled={!localPrefs.enabled}
          className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
        />
        Notify on renewal failure
      </label>

      {onUpdate && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || saveStatus === "saving"}
            onClick={handleSave}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving..." : "Save preferences"}
          </button>
          {saveStatus === "saved" && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved successfully</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-600 dark:text-red-400">Failed to save. Please try again.</span>
          )}
        </div>
      )}
    </div>
  );
}

export function AutoRenewalStatus({
  loans,
  preferences,
  isLoading = false,
  error = null,
  scope,
  onToggleLoan,
  onUpdatePreferences,
  className,
}: AutoRenewalStatusProps) {
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
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading auto-renewal status</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  if (loans.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <EmptyState />
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)} aria-label="Auto-renewal status and preferences">
      <PreferencesPanel
        preferences={preferences}
        scope={scope}
        onUpdate={onUpdatePreferences}
      />

      <div className="space-y-3">
        {loans.map((loan) => (
          <LoanRenewalCard key={loan.id} loan={loan} onToggle={onToggleLoan} />
        ))}
      </div>
    </section>
  );
}
