"use client";

import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanInput } from "./BarcodeScanInput";
import { LocationHierarchySelector } from "./LocationHierarchySelector";
import type {
  LocationNode,
  LocationSelection,
  StocktakeDiscrepancy,
  StocktakeExpectedItem,
  StocktakeSession,
} from "@/src/features/library/types/library.types";

export type StocktakeStep = "location" | "scan" | "review" | "closed";

const ACTIVE_SESSION_KEY = "elibrary-stocktake-session:active";

export interface StocktakeSessionProps {
  nodes: LocationNode[];
  session: StocktakeSession | null;
  isLoading?: boolean;
  error?: string | null;
  locationsLoading?: boolean;
  locationsError?: string | null;
  onStartSession?: (location: LocationSelection, locationLabel: string) => Promise<{ success: boolean; session?: StocktakeSession; error?: string }>;
  onScan?: (barcode: string) => Promise<{ success: boolean; duplicate?: boolean; error?: string; session?: StocktakeSession }>;
  onComplete?: (discrepanciesReviewed: boolean) => Promise<{ success: boolean; error?: string; session?: StocktakeSession }>;
  className?: string;
}

function locationLabelFromNodes(nodes: LocationNode[], selection: LocationSelection): string {
  const ids = [selection.branchId, selection.roomId, selection.shelfId, selection.binId].filter(Boolean) as string[];
  const labels: string[] = [];
  for (const id of ids) {
    const find = (list: LocationNode[]): string | undefined => {
      for (const n of list) {
        if (n.id === id) return n.label;
        if (n.children) {
          const c = find(n.children);
          if (c) return c;
        }
      }
      return undefined;
    };
    const label = find(nodes);
    if (label) labels.push(label);
  }
  return labels.join(" / ");
}

/**
 * Browser storage is intentionally limited to a session identifier. The API is
 * always the authority for its contents, so a stale device can never overwrite
 * a newer server session when it reconnects.
 */
export function persistActiveStocktakeSessionId(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } catch {
    /* ignore quota errors */
  }
}

export function clearPersistedStocktakeSessionId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function loadPersistedStocktakeSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

/** #934: Guided stocktake with scan feedback, discrepancy review, and persisted progress. */
export function StocktakeSessionView({
  nodes,
  session,
  isLoading,
  error,
  locationsLoading,
  locationsError,
  onStartSession,
  onScan,
  onComplete,
  className,
}: StocktakeSessionProps) {
  const [step, setStep] = useState<StocktakeStep>(session ? "scan" : "location");
  const [selection, setSelection] = useState<LocationSelection>(session?.location ?? {});
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setStep(session.status === "closed" ? "closed" : session.status === "review" ? "review" : "scan");
    }
  }, [session]);

  const expectedCount = session?.expectedItems.length ?? 0;
  const foundCount = session?.scannedItems.filter((i) => i.status === "found").length ?? 0;
  const discrepancies: StocktakeDiscrepancy[] = session?.discrepancies ?? [];

  const handleStart = useCallback(async () => {
    if (!onStartSession || !selection.branchId) return;
    setStarting(true);
    setStartError(null);
    const label = locationLabelFromNodes(nodes, selection);
    try {
      const result = await onStartSession(selection, label);
      if (result.success && result.session) {
        setStep("scan");
      } else if (!result.success) {
        setStartError(result.error ?? "Failed to start stocktake session.");
      }
    } finally {
      setStarting(false);
    }
  }, [onStartSession, selection, nodes]);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!onScan || !session) {
        return { success: false, error: "No active session" };
      }
      const result = await onScan(barcode);
      if (result.success && result.session) {
        const scanned = result.session.scannedItems.find((item) => item.barcode === barcode);
        setScanFeedback(result.duplicate ? `Already scanned: ${scanned?.title ?? barcode}` : `Found: ${scanned?.title ?? barcode}`);
      }
      return result;
    },
    [onScan, session]
  );

  const handleComplete = useCallback(async () => {
    if (discrepancies.length > 0 && !reviewAcknowledged) {
      setCompleteError("Review all discrepancies before closing the session.");
      return;
    }
    if (!onComplete) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await onComplete(reviewAcknowledged || discrepancies.length === 0);
      if (result.success && result.session?.status === "closed") {
        setStep("closed");
      } else if (result.success) {
        setCompleteError("The server did not confirm that this session was closed.");
      } else {
        setCompleteError(result.error ?? "Failed to close session.");
      }
    } finally {
      setCompleting(false);
    }
  }, [onComplete, discrepancies.length, reviewAcknowledged]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" role="status" aria-label="Loading stocktake">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-40 rounded border bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (step === "closed") {
    return (
      <Card className={className} role="status">
        <CardHeader>
          <CardTitle>Stocktake session closed</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>{session?.locationLabel}</p>
          <p>
            Scanned {foundCount} of {expectedCount} expected items.
          </p>
          {discrepancies.length > 0 && (
            <p>{discrepancies.length} discrepancies were reviewed and recorded.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2 text-xs">
        {(["location", "scan", "review"] as StocktakeStep[]).map((s) => (
          <span
            key={s}
            className={cn(
              "rounded-full px-3 py-1 capitalize",
              step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {s}
          </span>
        ))}
      </div>

      {step === "location" && (
        <Card>
          <CardHeader>
            <CardTitle>Select stocktake location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocationHierarchySelector
              nodes={nodes}
              selection={selection}
              onChange={setSelection}
              isLoading={locationsLoading}
              error={locationsError}
            />
            {startError && (
              <div role="alert" className="text-sm text-destructive">
                {startError}
              </div>
            )}
            <Button onClick={handleStart} disabled={!selection.branchId || starting}>
              {starting ? "Starting..." : "Start stocktake session"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "scan" && session && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Scan expected copies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{session.locationLabel}</p>
              <p role="status" aria-live="polite" className="text-sm font-medium">
                Progress: {foundCount} / {expectedCount} found
              </p>
              <BarcodeScanInput mode="stocktake" onScan={handleScan} lastScanMessage={scanFeedback} />
              <Button variant="outline" onClick={() => setStep("review")}>
                Review discrepancies
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected items</CardTitle>
            </CardHeader>
            <CardContent>
              {session.expectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expected items for this location.</p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {session.expectedItems.map((item: StocktakeExpectedItem) => {
                    const scanned = session.scannedItems.some(
                      (s) => s.barcode === item.barcode && s.status === "found"
                    );
                    return (
                      <li
                        key={item.copyId}
                        className={cn(
                          "rounded border px-2 py-1",
                          scanned ? "border-green-300 bg-green-50" : "border-muted"
                        )}
                      >
                        <span className="font-mono text-xs">{item.barcode}</span> — {item.title}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "review" && session && (
        <Card>
          <CardHeader>
            <CardTitle>Discrepancy review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {discrepancies.length === 0 ? (
              <p role="status" className="text-sm text-green-700">
                No discrepancies — all expected items accounted for.
              </p>
            ) : (
              <>
                <p className="text-sm text-amber-800">
                  {discrepancies.length} discrepancies require review before closing.
                </p>
                <ul className="space-y-2 text-sm">
                  {discrepancies.map((d) => (
                    <li key={`${d.type}-${d.barcode}`} className="rounded border p-2">
                      <span className="font-medium capitalize">{d.type}</span>: {d.title} (
                      <span className="font-mono">{d.barcode}</span>)
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reviewAcknowledged}
                    onChange={(e) => setReviewAcknowledged(e.target.checked)}
                  />
                  I have reviewed all discrepancies
                </label>
              </>
            )}
            {completeError && (
              <div role="alert" className="text-sm text-destructive">
                {completeError}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("scan")}>
                Back to scanning
              </Button>
              <Button onClick={handleComplete} disabled={completing}>
                {completing ? "Closing..." : "Close session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
